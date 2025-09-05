import * as browser from 'webextension-polyfill'

/*#__NO_SIDE_EFFECTS__*/
export function isContentScriptPage(): boolean {
  return !!browser.runtime.id && typeof browser.tabs?.sendMessage !== 'function'
}
