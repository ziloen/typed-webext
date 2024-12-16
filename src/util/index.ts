import * as browser from 'webextension-polyfill'

export { isSidepanelPage, isSidepanelPageSync } from './isSidepanelPage'
export { isBackgroundPage } from './isBackgroundPage'
export { isContentScriptPage } from './isContentScriptPage'


/**
 * Check if the tabs API is available
 */
/* #__NO_SIDE_EFFECTS__ */
export function isTabsApiAvailable(): boolean {
  return !!browser.tabs && typeof browser.tabs.sendMessage === 'function'
}


/** @internal */
/*#__NO_SIDE_EFFECTS__*/
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function asType<T>(value: any): asserts value is T {}

/* #__NO_SIDE_EFFECTS__ */
export function isSenderSidepanel(sender: browser.Runtime.MessageSender): void {
  return
}

/* #__NO_SIDE_EFFECTS__ */
export function isPopupPage(): void {

}


export async function getActiveTabId(): Promise<number> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })

  if (!tab) throw new Error('No active tab')
  const id = tab.id
  if (id === undefined) throw new Error('No active tab id')
  return id
}