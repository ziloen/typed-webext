import * as browser from "webextension-polyfill"

/**
 * Check if the current page is the background page
 */
/* #__NO_SIDE_EFFECTS__ */
export function isBackgroundPage() {
  // Chromium
  if (!('serviceWorker' in navigator) && !browser.extension.getViews) {
    return true
  }

  // Firefox
  try {
    const currentUrl = new URL(window.location.href)
    // @ts-expect-error background is not in all manifest type
    const scripts = browser.runtime.getManifest().background.scripts as string[]
    return scripts.some((script: string) => {
      const url = new URL(browser.runtime.getURL(script))
      return currentUrl.pathname === url.pathname && currentUrl.origin === url.origin
    })
  } catch {
    return false
  }
}
