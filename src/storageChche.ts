import { Subject } from 'rxjs'
import Browser from 'webextension-polyfill'

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
  #update$ = new Subject<string[]>()

  getData(keys: string[]): Record<string, CacheObj> | null {
    const cacheObj: Record<string, CacheObj> = {}

    const missingKeys = []

    for (const key of keys) {
      const cache = this.#cache.get(key)
      if (!cache) {
        missingKeys.push(key)
      } else {
        cacheObj[key] = cache
      }
    }

    // 有缺失的数据
    if (missingKeys.length) {
      this.#fetchStorage(missingKeys)
      return null
    }

    return cacheObj
  }

  watch(
    keys: string[],
    updateCallback: (data: Record<string, CacheObj>) => void,
  ) {
    const subscription = this.#update$.subscribe((updateKeys) => {
      const needUpdate = hasIntersection(updateKeys, keys)

      if (needUpdate) {
        const newData = this.getData(keys)
        if (newData) {
          updateCallback(newData)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }

  #fetchStorage(keys: string[]) {
    const missingKeys = keys.filter((key) => !this.#fetchingKeys.has(key))
    if (!missingKeys.length) {
      return
    }

    for (const key of missingKeys) {
      this.#fetchingKeys.add(key)
    }

    Browser.storage.local.get(missingKeys).then((data) => {
      for (const key of missingKeys) {
        this.#fetchingKeys.delete(key)
        this.#cache.set(key, {
          data: data[key],
          exists: Object.hasOwn(data, key),
        })
      }

      this.#update$.next(missingKeys)
    })
  }

  constructor() {
    Browser.storage.local.onChanged.addListener((changes) => {
      const keys = Object.keys(changes)

      for (const [key, change] of Object.entries(changes)) {
        if (this.#cache.has(key)) {
          this.#cache.set(key, {
            data: change!.newValue,
            exists: Object.hasOwn(change!, 'newValue'),
          })
        }
      }

      this.#update$.next(keys)
    })
  }
}

function hasIntersection<T>(a: T[], b: T[]) {
  return a.some((v) => b.includes(v))
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
