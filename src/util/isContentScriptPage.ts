import * as browser from 'webextension-polyfill'

export function isContentScriptPage(): boolean {
  return !!browser.runtime.id && typeof browser.tabs?.sendMessage !== 'function'
}