import * as browser from "webextension-polyfill"
import { webextHandleMessage } from './message'
import { webextHandleStream } from './stream'

export { onMessage, sendMessage } from './message'
export { getStorageLocal, removeStorageLocal, setStorageLocal } from './storage'
export { onOpenStream, openStream } from './stream'


export interface StreamProtocol {

}


export interface MessageProtocol {

}


export interface StorageLocalProtocol {

}


// side effects
browser.runtime.onMessage.addListener(webextHandleMessage)
browser.runtime.onConnect.addListener(webextHandleStream)
