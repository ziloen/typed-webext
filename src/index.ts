export { listenExtensionEvent } from './listenExtensionEvent'
export { onMessage, sendMessage, webextHandleMessage } from './message'
export {
  getStorageLocal,
  onStorageLocalChanged,
  removeStorageLocal,
  setStorageLocal,
} from './storage'
export { onOpenStream, openStream, webextHandleStream } from './stream'

/**
 * Used by `onOpenStream` and `openStream`
 */
export interface StreamProtocol {
  /** @internal */
  __test__: [string, number]
}

/**
 * Used by `onMessage` and `sendMessage`
 */
export interface MessageProtocol<T = unknown> {
  /** @internal */
  __test__: [data: string, result: number]
}

/**
 * Used by `getStorageLocal`, `removeStorageLocal`, `setStorageLocal` and `onStorageLocalChanged`
 */
export interface StorageLocalProtocol {
  /** @internal */
  __test__string_literal: 'A' | 'B'
  /** @internal */
  __test__string_array: string[]
}
