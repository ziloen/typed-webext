import * as browser from "webextension-polyfill"
import type { StorageLocalProtocol } from './index'

type Key = keyof StorageLocalProtocol
type StorageValue<K extends Key> = StorageLocalProtocol[K]

/**
 * Get storage.local value
 * @example
 * ```ts
 * const data = await getStorageLocal<number[]>('a')
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
 * const a = await getStorageLocal<number[]>('a', [])
 * //    ^ number[]
 * ```
 */
export async function getStorageLocal<K extends Key, D, V = StorageValue<K>>(
  key: K,
  defaultValue: D
): Promise<D extends V ? V : V | D>
/**
 * Get multiple storage.local values
 * @example
 * ```ts
 * const { a, b } = await getStorageLocal<{ a: string, b: number }>(['a', 'b'])
 * //      ^ { a?: string, b?: number }
 * ```
 */
export async function getStorageLocal<K extends Key>(key: K[]): Promise<{
  [key in K]?: StorageValue<K>
}>
/**
 * Get multiple storage.local values with default values
 * @example
 * ```ts
 * const { a, b } = await getStorageLocal({ a: 123, b: 'b' })
 * //      ^ { a: number, b: string }
 * ```
 */
export async function getStorageLocal<O extends { [K in Key]?: unknown }>(
  obj: O
): Promise<{
  [K in keyof O]: K extends Key
  ? O[K] extends StorageValue<K>
  ? StorageValue<K>
  : StorageValue<K> | O[K]
  : O[K]
}>
export async function getStorageLocal(
  key: string | string[] | Record<string, unknown>,
  defaultValue?: unknown
) {
  const result = await browser.storage.local.get(key)
  if (typeof key === 'string') {
    // If key exists in storage.local
    if (Object.hasOwn(result, key)) {
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

export async function setStorageLocal(items: { [K in Key]?: StorageValue<K> }) {
  return browser.storage.local.set(items)
}

type ChangesType = {
  [K in keyof StorageLocalProtocol]?: {
    oldValue?: StorageLocalProtocol[K]
    newValue?: StorageLocalProtocol[K]
  }
} & {
    [K in string & Record<never, never>]?: {
      oldValue?: unknown
      newValue?: unknown
    }
  }

export function onStorageLocalChanged(callback: (changes: ChangesType) => void) {
  browser.storage.local.onChanged.addListener(callback)

  return () => browser.storage.local.onChanged.removeListener(callback)
}
