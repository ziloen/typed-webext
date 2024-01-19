import * as browser from "webextension-polyfill"
import { webextHandleMessage } from './message'
import { webextHandleStream } from './stream'

export { onMessage, sendMessage } from './message'
export { getStorageLocal, removeStorageLocal, setStorageLocal, onStorageLocalChanged } from './storage'
export { onOpenStream, openStream } from './stream'


/**
 * Used by `onOpenStream` and `openStream`
 */
export interface StreamProtocol {

}


/**
 * Used by `onMessage` and `sendMessage`
 */
export interface MessageProtocol {

}


/**
 * Used by `getStorageLocal`, `removeStorageLocal`, `setStorageLocal` and `onStorageLocalChanged`
 */
export interface StorageLocalProtocol {

}


// side effects
browser.runtime.onMessage.addListener(webextHandleMessage)
browser.runtime.onConnect.addListener(webextHandleStream)
