export { onMessage, sendMessage, webextHandleMessage } from "./message"
export { getStorageLocal, onStorageLocalChanged, removeStorageLocal, setStorageLocal } from "./storage"
export { onOpenStream, openStream, webextHandleStream } from "./stream"

/**
 * Used by `onOpenStream` and `openStream`
 */
export interface StreamProtocol {

}


/**
 * Used by `onMessage` and `sendMessage`
 */
export interface MessageProtocol<T = unknown> {

}


/**
 * Used by `getStorageLocal`, `removeStorageLocal`, `setStorageLocal` and `onStorageLocalChanged`
 */
export interface StorageLocalProtocol {

}


