import { useLayoutEffect, useRef, useState } from 'react'
import type { Observable, Subscription } from 'rxjs'
import { fromEventPattern, share, Subject } from 'rxjs'
import Browser from 'webextension-polyfill'
import type { StorageLocalProtocol } from './index'
import type { ObjectDefaults, StorageLocalChange } from './storage'

/**
 * @param keys - The keys to listen to in storage.local
 * @returns A tuple containing the current state of the specified keys and a loading boolean
 */
export function useStorageLocal<K extends keyof StorageLocalProtocol>(
  keys: readonly K[],
): [
  state: {
    [Key in keyof Pick<StorageLocalProtocol, keyof StorageLocalProtocol & K>]?:
      | StorageLocalProtocol[Key]
      | undefined
  },
  loading: boolean,
]

/**
 * @param defaults - An object specifying default values for keys in storage.local
 * @returns A tuple containing the current state of the specified keys with defaults and a loading boolean
 */
export function useStorageLocal<const O extends Record<string, any>>(
  defaults:
    | O
    | ({
        [Key in keyof StorageLocalProtocol]:
          | StorageLocalProtocol[Key]
          | NoInfer<O>[Key]
      } & Record<string, any>),
): [state: ObjectDefaults<O>, loading: boolean]

export function useStorageLocal(keys: string[] | Record<string, any>) {
  const sub = useRef<null | Subscription>(null)
  const keysLatest = useRef(keys)
  keysLatest.current = keys

  function initState(): [state: Record<string, unknown>, loading: boolean] {
    const isArray = Array.isArray(keys)
    const storageKyes = new Set(isArray ? keys : Object.keys(keys))

    // 保存当前结果
    let state: Record<string, unknown> | null = null

    // 监听
    sub.current = cache.update$.subscribe((updateKeys) => {
      // 如果更新的 key 包含在监听的 key 中，则更新
      const intersection = updateKeys.intersection(storageKyes)
      if (!intersection.size) return

      const newData = cache.getData(state === null ? storageKyes : intersection)
      if (!newData) return

      setResult([
        (state = buildState(state, newData, keysLatest.current)),
        false,
      ])
    })

    // 初始化
    const data = cache.getData(storageKyes)

    if (data) {
      return [(state = buildState(state, data, keysLatest.current)), false]
    } else {
      return [isArray ? {} : keys, true]
    }
  }

  const [result, setResult] = useState(initState)

  useLayoutEffect(() => {
    if (!sub.current) {
      setResult(initState())
    }

    return () => {
      sub.current?.unsubscribe()
      sub.current = null
    }
  }, [])

  return result
}

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

const cache = /* #__PURE__ */ new StorageCache()

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
