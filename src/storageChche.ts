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
      for (const [key, change] of Object.entries(changes)) {
        if (!this.#cache.has(key)) {
          continue
        }

        this.#cache.set(key, {
          data: structuredClone(change.newValue),
          exists: Object.hasOwn(change, 'newValue'),
        })
      }

      this.update$.next(new Set(Object.keys(changes)))
    })
  }
}

function buildState(
  newState: Record<string, CacheObj>,
  defaultState: string[] | Record<string, unknown>,
) {
  if (Array.isArray(defaultState)) {
    const state: Record<string, unknown> = {}
    for (const key of defaultState) {
      if (newState[key]?.exists) {
        state[key] = newState[key].data
      }
    }
    return state
  }

  const state: Record<string, unknown> = {}
  for (const key in defaultState) {
    state[key] = newState[key]?.exists ? newState[key].data : defaultState[key]
  }

  return state
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
