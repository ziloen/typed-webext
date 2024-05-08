/* eslint-disable @typescript-eslint/no-invalid-void-type */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { ErrorObject } from 'serialize-error'
import { deserializeError, serializeError } from 'serialize-error'
import type { IfNever, Promisable, ReadonlyDeep } from 'type-fest'
import type { Runtime } from 'webextension-polyfill'
import * as browser from "webextension-polyfill"
import type { MessageProtocol } from './index'
import { isBackgroundPage, isTabsApiAvailable, isSidepanelPageSync, getActiveTabId, isContentScriptPage } from './util'


const BackgroundForwardMessageId = '__webext_forward_tabs_message__'

const MessageIdentifierKey = '__webext_message_identifier__'

type Message<Data> = {
  id: string
  /**
   * The sender of the message
   */
  sender: Runtime.MessageSender
  data: Data
  /**
   * The original sender of the message if it is forwarded by background
   */
  originalSender?: Runtime.MessageSender | undefined
}

type MsgKey = keyof MessageProtocol
type MsgData<Key extends MsgKey> = MessageProtocol[Key][0]
type MsgReturn<Key extends MsgKey, Data = unknown> = MessageProtocol<Data>[Key][1]

type MsgCallback<Data = MsgData<MsgKey>, Return = MsgReturn<MsgKey>> = (
  message: Message<Data>
) => IfNever<Return, void, Promisable<Return>>

type PassiveCallback<Data = MsgData<MsgKey>> = (message: Message<Data>) => void

type SendParams<K extends MsgKey, D> = IfNever<
  D,
  [id: K, data?: undefined | null, options?: SendMessageOptions],
  [id: K, data: D, options?: SendMessageOptions]
>

type SendMessageOptions = {
  /**
   * The ID of the tab which the message will be sent to.
   * 
   * - `undefined`: The message will be sent to all.
   * - `'sender'`: The message will be sent to the sender of the message.
   * - `'active'`: The message will be sent to the active tab.
   * - `number`: The ID of the tab which the message will be sent to.
   */
  tabId?: number | undefined | 'sender' | "active"
  frameId?: number | undefined | 'sender'
  /**
   * The destination of the message.
   * 
   * - `'sidebar'`: The message will be sent to the sidebar / side panel.
   * - `'popup'`: The message will be sent to the popup.
   */
  destination?: "content-script" | "sidebar"  /* | "background" | "popup" | "options" | "devtools" */
}

export async function sendMessage<Key extends MsgKey, Data extends MsgData<Key>>(...args: SendParams<Key, Data>) {
  if (!browser.runtime.id) {
    throw new Error('Extension context is not available.')
  }

  const [id, data, options = {}] = args

  const tabId = options.tabId
  const frameId = options.frameId
  const destination = options.destination

  type Res = { data: MsgReturn<Key, Data> } | { error: ErrorObject } | null | undefined

  let res: Res

  if (destination === "content-script" && isContentScript) {
    res = await browser.runtime.sendMessage({
      [MessageIdentifierKey]: 1,
      id: BackgroundForwardMessageId,
      data: {
        tabId,
        frameId,
        id,
        data,
        destination,
      },
    })
  }
  // No tabId, send directly to background
  else if (tabId === undefined) {
    res = await browser.runtime.sendMessage({
      [MessageIdentifierKey]: 1,
      id,
      data,
      destination,
    })
  }
  // Send to tab and tabs API is available
  else if (
    tabId !== 'sender' &&
    frameId !== 'sender' &&
    isTabsApiAvailable()
  ) {
    res = await browser.tabs.sendMessage(
      tabId === 'active' ? await getActiveTabId() : tabId,
      {
        [MessageIdentifierKey]: 1,
        id,
        data,
        destination,
      },
      frameId === undefined ? undefined : { frameId }
    )
  }
  // Send to tab and tabs API is not available, forward by background
  else {
    res = await browser.runtime.sendMessage({
      [MessageIdentifierKey]: 1,
      id: BackgroundForwardMessageId,
      data: {
        tabId,
        frameId,
        id,
        data,
        destination,
      },
    })
  }

  // when null, message is already handled by other listeners
  if (res === null) {
    throw new Error(
      `null from runtime.sendMessage. Maybe multiple async runtime.onMessage listeners for message "${id}".`
    )
  }

  // when undefined, no listener for the message, or the listener return undefined
  if (res === undefined) {
    throw new Error(`undefined from runtime.sendMessage. No listener for message "${id}". or the listener return undefined.`)
  }

  if (Object.hasOwn(res, 'error')) {
    throw deserializeError(res.error)
  }

  return res.data
}

const listenersMap = new Map<string, MsgCallback>()
const pasiveListenersMap = new Map<string, Set<PassiveCallback>>()

type OnMessageOptions<P extends boolean> = {
  passive?: P
  signal?: AbortSignal
  // TODO: 
  // once?: boolean
}

// TODO: Allow add multiple listeners in one onMessage call
/**
 * Add a passive listener to the message channel.
 *
 * Passive listeners return value is ignored.
 *
 * You can add multiple passive listeners to the same channel.
 *
 * @example
 * ```ts
 * const dispose = onMessage(
 *   "log length to console",
 *   ({ data }) => { console.log(data.length) },
 *   { passive: true }
 * )
 * ```
 */
export function onMessage<K extends MsgKey>(
  id: K,
  callback: PassiveCallback<ReadonlyDeep<MsgData<K>>>,
  options: OnMessageOptions<true>
): () => void
/**
 * Add a listener to the message channel.
 *
 * You can only add one listener to the same channel.
 *
 * @example
 * ```ts
 * const dispose = onMessage(
 *   "get message length",
 *   ({ data }) => data.length
 * )
 * ```
 */
export function onMessage<K extends MsgKey>(
  id: K,
  callback: MsgCallback<MsgData<K>, MsgReturn<K>>,
  options?: OnMessageOptions<boolean>,
): () => void
export function onMessage<K extends MsgKey>(
  id: K,
  callback: MsgCallback<MsgData<K>, MsgReturn<K>>,
  options: OnMessageOptions<boolean> = {},
) {
  const passive = options.passive ?? false
  const signal = options.signal

  if (signal?.aborted) {
    return () => { }
  }

  if (passive) {
    const listeners = pasiveListenersMap.get(id) ?? new Set()
    listeners.add(callback)
    pasiveListenersMap.set(id, listeners)
    const removeListener = () => listeners.delete(callback)

    if (signal) {
      signal.addEventListener('abort', removeListener, { once: true })
    }

    return () => {
      removeListener()
      if (signal) {
        signal.removeEventListener('abort', removeListener)
      }
    }
  }

  const listener = listenersMap.get(id)
  if (listener) throw new Error(`Message ID "${id}" already has a listener.`)
  listenersMap.set(id, callback)
  const removeListener = () => listenersMap.delete(id)
  if (signal) {
    signal.addEventListener('abort', removeListener)
  }
  return () => {
    removeListener()
    if (signal) {
      signal.removeEventListener('abort', removeListener)
    }
  }
}

/**
 * 
 */
const isBackground = /* #__PURE__ */ isBackgroundPage()

const isSidepanel = /* #__PURE__ */ isSidepanelPageSync()

const isContentScript = /* #__PURE__ */ isContentScriptPage()

/**
 * Handle message from runtime.onMessage
 */
export function webextHandleMessage(
  message:
    | {
      id: MsgKey
      data: MsgData<MsgKey>
      /** 
       * Forwarded message sender
       */
      sender?: Runtime.MessageSender
      destination?: "sidebar" | "content-script"
      [MessageIdentifierKey]?: 1
    }
    | undefined,
  sender: Runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) {
  if (message?.[MessageIdentifierKey] !== 1) {
    return
  }

  if (message.destination === "sidebar" && !(isSidepanel)) {
    return
  }

  if (message.destination === "content-script" && !(isContentScript)) {
    return
  }

  if (isBackground) {
    const res = handleForwardMessage(message, sender)
    if (res) {
      return res
    }
  }

  const id = message.id

  // Run all passive listeners
  const passiveListeners = pasiveListenersMap.get(id)
  if (passiveListeners) {
    for (const cb of passiveListeners) {
      try {
        cb({
          id,
          data: message.data,
          sender,
          originalSender: message.sender,
        })
      } catch (e) {
        // ignore passive listener error
        // catch error to prevent runtime.onMessage from throwing
        console.error(e)
      }
    }
  }

  // Run the listener
  const listener = listenersMap.get(id)
  if (!listener) {
    return
  }

  ; (async () => {
    try {
      sendResponse({
        data: await listener({
          id,
          data: message.data,
          sender,
          originalSender: message.sender,
        })
      })
    } catch (error) {
      sendResponse({ error: serializeError(error instanceof Error ? error : new Error("Unknown error", { cause: error })) })
    }
  })()

  return true
}

function handleForwardMessage(message:
  {
    id?: string
    data?: unknown
    [MessageIdentifierKey]?: 1
  },
  sender: Runtime.MessageSender
) {
  if (message[MessageIdentifierKey] !== 1) return
  if (message.id !== BackgroundForwardMessageId) return

  return new Promise(async (resolve, reject) => {
    const { tabId, frameId, id, data, destination: destination } = message.data as {
      tabId: number | 'sender' | "active" | undefined
      frameId: number | undefined | 'sender'
      id: string
      data: unknown
      destination?: "sidebar" | "content-script"
    }

    let targetTabId: number | undefined
    try {
      targetTabId = tabId === 'sender'
        ? sender.tab!.id!
        : tabId === "active"
          ? await getActiveTabId()
          : tabId
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return reject(error)
    }

    const targetFrameId = frameId === 'sender' ? sender.frameId : frameId

    if (destination === "content-script" && targetTabId === undefined) {
      resolve(browser.runtime.sendMessage({
        [MessageIdentifierKey]: 1,
        id,
        data,
        sender,
        destination,
      }))

      return
    }

    resolve(browser.tabs.sendMessage(
      targetTabId!,
      {
        id,
        data,
        sender,
        destination,
        [MessageIdentifierKey]: 1,
      },
      targetFrameId === undefined ? undefined : { frameId: targetFrameId }
    ))
  })

}

// FIXME: side effects
if (browser.runtime.onMessage.hasListeners()) {
  throw new Error(
    `runtime.onMessage already has listeners, typed-webext/message can't handle message.`
  )
} else {
  browser.runtime.onMessage.addListener(webextHandleMessage)
}

