import Browser from 'webextension-polyfill'
import type { Menus, Tabs } from 'webextension-polyfill'

export type ContextMenuItem = Omit<
  Menus.CreateCreatePropertiesType,
  'id' | 'parentId' | 'onclick'
> & {
  id: string
  children?: ContextMenuItem[]
  handler?: (info: Menus.OnClickData, tab: Tabs.Tab | undefined) => void
}

export function createContextMenu(items: ContextMenuItem[]): () => void {
  const listenersMap = new Map<
    string,
    (info: Menus.OnClickData, tab: Tabs.Tab | undefined) => void
  >()

  for (const item of items) {
    const { id, children, handler, ...props } = item

    Browser.contextMenus.create({
      id,
      ...props,
    })

    if (handler) {
      listenersMap.set(id, handler)
    }
  }

  Browser.contextMenus.create({})

  function listener(info: Menus.OnClickData, tab: Tabs.Tab | undefined) {
    const handler = listenersMap.get(info.menuItemId as string)
    if (handler) {
      handler(info, tab)
    }
  }

  Browser.contextMenus.onClicked.addListener(listener)

  return () => {
    Browser.contextMenus.onClicked.removeListener(listener)
  }
}
