type OnClickData = chrome.contextMenus.OnClickData
type Tab = chrome.tabs.Tab

export type ContextMenuItem = Omit<
  chrome.contextMenus.CreateProperties,
  'id' | 'parentId' | 'onclick'
> & {
  id: string
  children?: ContextMenuItem[]
  handler?: (info: OnClickData, tab: Tab | undefined) => void
}

export function createContextMenu(items: ContextMenuItem[]): () => void {
  const listenersMap = new Map<
    string | number,
    (info: OnClickData, tab: Tab | undefined) => void
  >()

  for (const item of items) {
    const { id, children, handler, ...props } = item

    browser.contextMenus.create({
      id,
      ...props,
    })

    if (handler) {
      listenersMap.set(id, handler)
    }
  }

  browser.contextMenus.create({})

  function listener(info: OnClickData, tab: Tab | undefined) {
    const handler = listenersMap.get(info.menuItemId)
    if (handler) {
      handler(info, tab)
    }
  }

  browser.contextMenus.onClicked.addListener(listener)

  return () => {
    browser.contextMenus.onClicked.removeListener(listener)
  }
}
