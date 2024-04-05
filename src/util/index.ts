import * as browser from "webextension-polyfill"

export { isSidepanelPage, isSidepanelPageSync } from "./isSidepanelPage"
export { isBackgroundPage } from "./isBackgroundPage"


/**
 * Check if the tabs API is available
 */
/* #__NO_SIDE_EFFECTS__ */
export function isTabsApiAvailable() {
  return browser.tabs && typeof browser.tabs.sendMessage === 'function'
}


/* #__NO_SIDE_EFFECTS__ */
export function isSenderSidepanel(sender: browser.Runtime.MessageSender) {

}

/* #__NO_SIDE_EFFECTS__ */
export function isPopupPage() {

}


export async function getActiveTabId() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })

  if (!tab) throw new Error('No active tab')
  const id = tab.id
  if (id === undefined) throw new Error('No active tab id')
  return id
}