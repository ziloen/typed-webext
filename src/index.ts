/* eslint-disable @typescript-eslint/no-empty-object-type */
export { listenExtensionEvent } from './listenExtensionEvent'
export { onMessage, sendMessage, webextHandleMessage } from './message'
export {
  getStorageLocal,
  onStorageLocalChanged,
  removeStorageLocal,
  setStorageLocal,
} from './storage'
export { onOpenStream, openStream, webextHandleStream } from './stream'
export type { Stream } from './stream'

/**
 * Used by `onOpenStream` and `openStream`
 *
 * @example
 * ```ts
 * interface StreamProtocol {
 *   chat: [prompt: string, response: string]
 * }
 * ```
 */
export interface StreamProtocol {
  /** @internal */
  __test__: [string, number]
}

/**
 * Used by `onMessage` and `sendMessage`
 *
 * @example
 * ```ts
 * interface MessageProtocol {
 *   greet: [name: string, greeting: string]
 * }
 * ```
 */
export interface MessageProtocol<T = unknown> {}

/**
 * Used by `getStorageLocal`, `removeStorageLocal`, `setStorageLocal` and `onStorageLocalChanged`
 */
export interface StorageLocalProtocol {}
