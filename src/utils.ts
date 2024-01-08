import * as browser from 'webextension-polyfill'

export function isTabsApiAvailable() {
  return browser.tabs && typeof browser.tabs.sendMessage === 'function'
}


export const noop = (() => { }) as (...args: any[]) => void