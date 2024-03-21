/**
 * Used by `onOpenStream` and `openStream`
 */
export interface StreamProtocol {

}


/**
 * Used by `onMessage` and `sendMessage`
 */
export interface MessageProtocol<T = unknown> {
  a: [string, number]
}


/**
 * Used by `getStorageLocal`, `removeStorageLocal`, `setStorageLocal` and `onStorageLocalChanged`
 */
export interface StorageLocalProtocol {

}


