/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as browser from 'webextension-polyfill'

let isSidepanel: boolean | undefined
/**
 * Check if the current page is the sidepanel page
 */
export function isSidepanelPage(): Promise<boolean> | boolean {
  if (isSidepanel !== undefined) return isSidepanel
  return new Promise<boolean>((resolve, reject) => {

    try {
      // @ts-expect-error sidePanel is not in the browser type
      if (!browser.sidePanel.getOptions) throw new Error('sidePanel is not supported')

      const currentUrl = new URL(window.location.href)
      // @ts-expect-error side_panel is not in the manifest type
      browser.sidePanel.getOptions({}, options => {
        const path = options.path as string
        const sidepanelUrl = new URL(browser.runtime.getURL(path))
        isSidepanel = currentUrl.pathname === sidepanelUrl.pathname && currentUrl.origin === sidepanelUrl.origin
        resolve(isSidepanel)
      })
    } catch {
      try {
        if (!browser.sidebarAction.getPanel) throw new Error('sidebarAction is not supported')

        const currentUrl = new URL(window.location.href)
        browser.sidebarAction.getPanel({}).then(panel => {
          const sidepanelUrl = new URL(panel)
          isSidepanel = currentUrl.pathname === sidepanelUrl.pathname && currentUrl.origin === sidepanelUrl.origin
          resolve(isSidepanel)
        })
      } catch {
        resolve(isSidepanel = false)
      }
    }
  })
}



export function isSidepanelPageSync(): boolean {
  try {
    const manifest = /* #__PURE__ */ browser.runtime.getManifest()
    // @ts-expect-error side_panel is not in the manifest type
    const sidepanelPath = manifest.side_panel.default_path as string
    const sidepanelUrl = new URL(browser.runtime.getURL(sidepanelPath))
    const currentUrl = new URL(window.location.href)
    return (
      currentUrl.pathname === sidepanelUrl.pathname && currentUrl.origin === sidepanelUrl.origin
    )
  } catch {
    return false
  }
}