import * as browser from 'webextension-polyfill'
import type { StorageLocalProtocol } from './index'

type Key = keyof StorageLocalProtocol
type StorageValue<K extends Key> = StorageLocalProtocol[K]

type MakeArrayReadonly<T> = T extends (infer U)[] ? readonly U[] : T
type MakeArrayWritable<T> = T extends readonly (infer U)[]
  ? T extends unknown[]
    ? T
    : U[]
  : T

type ValueWithDefault<
  Value,
  Default,
> = Default extends MakeArrayReadonly<Value> ? Value : Value | MakeArrayWritable<Default>

type ObjectDefaults<Defaults> = {
  -readonly [K in keyof Defaults]:
  K extends keyof StorageLocalProtocol
    ? ValueWithDefault<StorageLocalProtocol[K], Defaults[K]>
    : Defaults[K]
}

/**
 * Get storage.local value
 * @example
 * ```ts
 * interface StorageLocalProtocol {
 *   a: number[]
 * }
 * 
 * const data = await getStorageLocal('a')
 * //    ^ number[] | undefined
 * ```
 */
export async function getStorageLocal<K extends Key>(
  key: K
): Promise<StorageValue<K> | undefined>
/**
 * Get storage.local value with default value
 * @example
 * ```ts
 * interface StorageLocalProtocol {
 *   a: number[]
 * }
 * 
 * const a = await getStorageLocal('a', [])
 * //    ^ number[]
 * ```
 */
export async function getStorageLocal<
  K extends Key,
  V = StorageValue<K>,
  const D = V
>(
  key: K,
  defaultValue: D
): Promise<ValueWithDefault<V, D>>
/**
 * Get multiple storage.local values
 * @example
 * ```ts
 * interface StorageLocalProtocol {
 *   a: string
 *   b: number
 * }
 * 
 * const { a, b } = await getStorageLocal(['a', 'b'])
 * //    ^ { a?: string, b?: number }
 * ```
 */
export async function getStorageLocal<const K extends Key>(key: K[]): Promise<{
  [P in K]?: StorageValue<P>
}>
/**
 * Get multiple storage.local values with default values
 * @example
 * ```ts
 * interface StorageLocalProtocol {
 *   a: string
 *   b: number
 * }
 * 
 * const { a, b } = await getStorageLocal({ a: 123, b: 'b' })
 * //    ^ { a: number, b: string }
 * ```
 */
export async function getStorageLocal<const O = Partial<StorageLocalProtocol>>(
  obj: O
): Promise<ObjectDefaults<O>>
export async function getStorageLocal(
  key: string | string[] | Record<string, unknown>,
  defaultValue?: unknown
) {
  const result = await /* #__PURE__ */ browser.storage.local.get(key)
  if (typeof key === 'string') {
    // If key exists in storage.local
    if (/* #__PURE__ */ Object.hasOwn(result, key)) {
      return result[key] as unknown
    }

    // If key does not exist in storage.local
    return defaultValue as unknown
  } else {
    return result as unknown
  }
}

export async function removeStorageLocal<K extends Key>(key: K): Promise<void>
export async function removeStorageLocal<K extends Key>(key: K[]): Promise<void>
export async function removeStorageLocal(key: string | string[]) {
  return browser.storage.local.remove(key)
}

/**
 * Set multiple storage.local values
 * 
 * @param items storage.local key-value pairs
 * 
 * @example
 * ```ts
 * await setStorageLocal({ a: 123, b: 'b' })
 * ```
 * Known issue: Computed property might not happy with TypeScript
 */
export async function setStorageLocal(items: Partial<StorageLocalProtocol>): Promise<void>
/**
 * Set one storage.local value
 * 
 * @param key storage.local key
 * @param value value to set
 * 
 * @example
 * ```ts
 * await setStorageLocal('a', 123)
 * ```
 */
export async function setStorageLocal<K extends Key>(
  key: K,
  value: StorageValue<K>
): Promise<void>
export async function setStorageLocal(items: string | Record<string, any>, value?: unknown) {
  if (typeof items === 'string') {
    return browser.storage.local.set({ [items]: value })
  } else {
    return browser.storage.local.set(items)
  }
}

type StorageLocalChange =
  // StorageLocalProtocol keys
  & {
    [K in Key]?: {
      readonly oldValue?: StorageValue<K>
      readonly newValue?: StorageValue<K>
    }
  }
  // Unknown keys
  & {
    [K in (string & Record<never, never>)]?: {
      readonly oldValue?: unknown
      readonly newValue?: unknown
    }
  }

export function onStorageLocalChanged(callback: (changes: StorageLocalChange) => void) {
  browser.storage.local.onChanged.addListener(callback)

  return () => browser.storage.local.onChanged.removeListener(callback)
}
