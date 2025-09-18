import * as browser from 'webextension-polyfill'

export { isBackgroundPage } from './isBackgroundPage'
export { isContentScriptPage } from './isContentScriptPage'
export { isSidepanelPage, isSidepanelPageSync } from './isSidepanelPage'

/**
 * Check if the tabs API is available
 */
/* #__NO_SIDE_EFFECTS__ */
export function isTabsApiAvailable(): boolean {
  return !!browser.tabs && typeof browser.tabs.sendMessage === 'function'
}

/** @internal */
/*#__NO_SIDE_EFFECTS__*/
export function asType<T>(value: any): asserts value is T {}

/* #__NO_SIDE_EFFECTS__ */
export function isSenderSidepanel(sender: browser.Runtime.MessageSender): void {
  return
}

/* #__NO_SIDE_EFFECTS__ */
export function isPopupPage(): void {}

/* #__NO_SIDE_EFFECTS__ */
export async function getActiveTabId(): Promise<number> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })

  if (!tab) throw new Error('No active tab')
  const id = tab.id
  if (id === undefined) throw new Error('No active tab id')
  return id
}

/* #__NO_SIDE_EFFECTS__ */
export const noop = (() => {}) as (...args: any[]) => void

/** @internal */
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false

/** @internal */
export type Expect<T extends true> = T
