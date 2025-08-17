import type { Observable } from 'rxjs'
import { fromEventPattern, share, Subject } from 'rxjs'
import Browser from 'webextension-polyfill'
import type { StorageLocalChange } from './storage'

interface CacheObj {
  /**
   * The data of the cache
   */
  data: unknown
  /**
   * Whether the data is exists in storage.local
   */
  exists: boolean
}

class StorageCache {
  #cache = new Map<string, CacheObj>()
  #fetchingKeys = new Set<string>()
  update$ = new Subject<Set<string>>()

  /**
   * - All data exists: returns a Map of key to CacheObj
   * - Some data missing: returns null, and fetches the missing data from storage.local
   */
  getData(keys: Set<string>): Map<string, CacheObj> | null {
    const data = new Map<string, CacheObj>()

    const missingKeys = new Set<string>()

    for (const key of keys) {
      const cache = this.#cache.get(key)
      if (!cache) {
        missingKeys.add(key)
      } else {
        data.set(key, cache)
      }
    }

    // 有缺失的数据
    if (missingKeys.size) {
      this.#fetchStorage(missingKeys)
      return null
    }

    return data
  }

  #fetchStorage(keys: Set<string>) {
    const missingKeys = keys.difference(this.#fetchingKeys)
    if (!missingKeys.size) {
      return
    }

    for (const key of missingKeys) {
      this.#fetchingKeys.add(key)
    }

    Browser.storage.local.get([...missingKeys]).then((data) => {
      for (const key of missingKeys) {
        this.#fetchingKeys.delete(key)
        this.#cache.set(key, {
          data: data[key],
          exists: Object.hasOwn(data, key),
        })
      }

      this.update$.next(missingKeys)
    })
  }

  constructor() {
    Browser.storage.local.onChanged.addListener((changes) => {
      const keys = new Set(Object.keys(changes))

      for (const key of keys) {
        if (!this.#cache.has(key)) {
          continue
        }

        const change = changes[key]!

        this.#cache.set(key, {
          // In Chrome, different listeners receive the same `changes` object
          // Prevent modifying the original object
          // In Firefox, the data may not be JSON-serializable, so we use `structuredClone()` instead of `JSON.parse(JSON.stringify())`.
          data: structuredClone(change.newValue),
          exists: Object.hasOwn(change, 'newValue'),
        })
      }

      this.update$.next(keys)
    })
  }
}

function buildState(
  oldState: Record<string, unknown> | null,
  newData: Map<string, CacheObj>,
  keys: string[] | Record<string, unknown>,
) {
  const newState: Record<string, unknown> = { ...oldState }
  const isArray = Array.isArray(keys)

  for (const [key, cacheObj] of newData) {
    if (cacheObj.exists) {
      newState[key] = structuredClone(cacheObj.data)
    } else {
      if (isArray) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete newState[key]
      } else {
        newState[key] = keys[key]
      }
    }
  }

  return newState
}

/**
 * Shared observable for storage.local changes
 */
export const storageLocalChanged$: Observable<StorageLocalChange> =
  /* #__PURE__ */ fromEventPattern(
    (handler) => Browser.storage.onChanged.addListener(handler),
    (handler) =>
      Browser.runtime.id && Browser.storage.onChanged.removeListener(handler),
    (changes: StorageLocalChange) => changes,
  ).pipe(/* #__PURE__ */ share({ resetOnRefCountZero: true }))
