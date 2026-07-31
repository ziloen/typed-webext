/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

let isSidepanel: boolean | undefined
/**
 * Check if the current page is the sidepanel page
 */
export function isSidepanelPage(): Promise<boolean> | boolean {
  if (isSidepanel !== undefined) return isSidepanel
  return new Promise<boolean>((resolve) => {
    try {
      if (!browser.sidePanel.getOptions)
        throw new Error('sidePanel is not supported')

      const currentUrl = new URL(window.location.href)
      browser.sidePanel.getOptions({}, (options) => {
        const path = options.path as string
        const sidepanelUrl = new URL(browser.runtime.getURL(path))
        isSidepanel =
          currentUrl.pathname === sidepanelUrl.pathname &&
          currentUrl.origin === sidepanelUrl.origin
        resolve(isSidepanel)
      })
    } catch {
      try {
        // @ts-expect-error sidebarAction is not in the browser type
        if (!browser.sidebarAction.getPanel)
          throw new Error('sidebarAction is not supported')

        const currentUrl = new URL(window.location.href)
        // @ts-expect-error sidebarAction is not in the browser type
        browser.sidebarAction.getPanel({}).then((panel) => {
          const sidepanelUrl = new URL(panel as string)
          isSidepanel =
            currentUrl.pathname === sidepanelUrl.pathname &&
            currentUrl.origin === sidepanelUrl.origin
          resolve(isSidepanel)
        })
      } catch {
        resolve((isSidepanel = false))
      }
    }
  })
}

/*#__NO_SIDE_EFFECTS__*/
export function isSidepanelPageSync(): boolean {
  try {
    const manifest = browser.runtime.getManifest()
    const sidepanelPath = manifest.side_panel.default_path as string
    const sidepanelUrl = new URL(browser.runtime.getURL(sidepanelPath))
    const currentUrl = new URL(window.location.href)
    return (
      currentUrl.pathname === sidepanelUrl.pathname &&
      currentUrl.origin === sidepanelUrl.origin
    )
  } catch {
    return false
  }
}
