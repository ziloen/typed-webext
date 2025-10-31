import type { ErrorObject } from 'serialize-error'
import { deserializeError, serializeError } from 'serialize-error'
import type { If, IsNever, Promisable, ReadonlyDeep } from 'type-fest'
import type { Runtime } from 'webextension-polyfill'
import * as browser from 'webextension-polyfill'
import type { MessageProtocol } from './index'
import {
  asType,
  getActiveTabId,
  isBackgroundPage,
  isContentScriptPage,
  isSidepanelPageSync,
  isTabsApiAvailable,
  noop,
} from './util'

const BgForwardMsgId = '__webext_forward_tabs_message__'

const MsgIdentifier = '__webext_message_identifier__'

type Message<Data, Return, Manual extends boolean> = {
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

  /**
   * Function to send a response. Only available if Manual is true.
   */
  sendResponse: Manual extends true
    ? (response: Promisable<Return>) => void
    : undefined
}

type MsgKey = keyof MessageProtocol
type MsgData<Key extends MsgKey> = MessageProtocol[Key][0]
type MsgReturn<
  Key extends MsgKey,
  Data = unknown,
> = MessageProtocol<Data>[Key][1]

type MsgCallback<
  Manual extends boolean = false,
  Data = MsgData<MsgKey>,
  Return = MsgReturn<MsgKey>,
> = (
  message: Message<Data, Return, Manual>,
) => Manual extends true ? any : If<IsNever<Return>, void, Promisable<Return>>

type SendParams<D> = If<
  IsNever<D>,
  [data?: undefined | null, options?: SendMessageOptions],
  [data: D, options?: SendMessageOptions]
>

interface SendMessageOptions {
  /**
   * The ID of the tab which the message will be sent to.
   *
   * - `undefined`: The message will be sent to all.
   * - `'sender'`: The message will be sent to the sender of the message.
   * - `'active'`: The message will be sent to the active tab.
   * - `number`: The ID of the tab which the message will be sent to.
   */
  tabId?: number | undefined | 'sender' | 'active'
  frameId?: number | undefined | 'sender'
  /**
   * The destination of the message.
   *
   * - `'sidebar'`: The message will be sent to the sidebar / side panel.
   * - `'popup'`: The message will be sent to the popup.
   */
  destination?:
    | 'content-script'
    | 'sidebar' /* | "background" | "popup" | "options" | "devtools" | "offscreen" */
}

async function sendMessageImpl<
  Key extends keyof MessageProtocol,
  Data extends MsgData<NoInfer<Key>>,
>(id: Key, ...[data, options = {}]: SendParams<Data>) {
  if (!browser.runtime.id) {
    throw new Error('Extension context is not available.')
  }

  const tabId = options.tabId
  const frameId = options.frameId
  const destination = options.destination

  type Res =
    | { data: MsgReturn<Key, Data> }
    | { error: ErrorObject }
    | null
    | undefined

  let res: Res

  if (destination === 'content-script' && isContentScript) {
    res = await browser.runtime.sendMessage({
      [MsgIdentifier]: 1,
      id: BgForwardMsgId,
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
      [MsgIdentifier]: 1,
      id,
      data,
      destination,
    })
  }
  // Send to tab and tabs API is available
  else if (tabId !== 'sender' && frameId !== 'sender' && isTabsApiAvailable()) {
    res = await browser.tabs.sendMessage(
      tabId === 'active' ? await getActiveTabId() : tabId,
      {
        [MsgIdentifier]: 1,
        id,
        data,
        destination,
      },
      frameId === undefined ? undefined : { frameId },
    )
  }
  // Send to tab and tabs API is not available, forward by background
  else {
    res = await browser.runtime.sendMessage({
      [MsgIdentifier]: 1,
      id: BgForwardMsgId,
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
      `null from runtime.sendMessage. Maybe multiple async runtime.onMessage listeners for message "${id}".`,
    )
  }

  // when undefined, no listener for the message, or the listener returns undefined
  if (res === undefined) {
    throw new Error(
      `undefined from runtime.sendMessage. No listener for message "${id}". or the listener returns undefined.`,
    )
  }

  if (Object.hasOwn(res, 'error')) {
    throw deserializeError(res.error)
  }

  return res.data
}

const listenersMap = new Map<string, MsgCallback>()
const manualListenersMap = new Map<string, Set<MsgCallback<true>>>()

type OnMsgOptions<M extends boolean> = {
  manual?: M
  signal?: AbortSignal
  // TODO:
  // once?: boolean
}

/**
 * Add a manual listener to the message channel.
 *
 * Manual listeners return value is ignored.
 *
 * You can add multiple manual listeners to the same channel.
 *
 * @example
 * ```ts
 * const dispose = onMessage(
 *   "log length to console",
 *   ({ data }) => { console.log(data.length) },
 *   { manual: true }
 * )
 * ```
 */
function onMessageImpl<Key extends keyof MessageProtocol>(
  id: Key,
  callback: MsgCallback<true, ReadonlyDeep<MsgData<Key>>, MsgReturn<Key>>,
  options: OnMsgOptions<true>,
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
function onMessageImpl<Key extends keyof MessageProtocol>(
  id: Key,
  callback: MsgCallback<false, MsgData<Key>, MsgReturn<Key>>,
  options?: OnMsgOptions<boolean>,
): () => void
function onMessageImpl<Key extends keyof MessageProtocol>(
  id: Key,
  callback: MsgCallback<
    boolean,
    MsgData<NoInfer<Key>>,
    MsgReturn<NoInfer<Key>>
  >,
  options: OnMsgOptions<boolean> = {},
) {
  const manual = options.manual ?? false
  const signal = options.signal

  if (signal?.aborted) {
    return noop
  }

  if (manual) {
    // TODO: use Map#getOrInsert
    const listeners = manualListenersMap.get(id) ?? new Set()
    listeners.add(callback)
    manualListenersMap.set(id, listeners)
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
  if (listener) {
    throw new Error(`Message ID "${id}" already has a listener.`)
  }
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

const isBackground = /* #__PURE__ */ isBackgroundPage()

const isSidepanel = /* #__PURE__ */ isSidepanelPageSync()

const isContentScript = /* #__PURE__ */ isContentScriptPage()

function handleForwardMessage(
  message: {
    id?: string
    data?: unknown
    [MsgIdentifier]?: 1
  },
  sender: Runtime.MessageSender,
) {
  if (message[MsgIdentifier] !== 1) return
  if (message.id !== BgForwardMsgId) return

  return new Promise(async (resolve, reject) => {
    const { tabId, frameId, id, data, destination } = message.data as {
      tabId: number | 'sender' | 'active' | undefined
      frameId: number | undefined | 'sender'
      id: string
      data: unknown
      destination?: 'sidebar' | 'content-script'
    }

    let targetTabId: number | undefined
    try {
      targetTabId =
        tabId === 'sender'
          ? sender.tab!.id!
          : tabId === 'active'
            ? await getActiveTabId()
            : tabId
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return reject(error)
    }

    const targetFrameId = frameId === 'sender' ? sender.frameId : frameId

    if (destination === 'content-script' && targetTabId === undefined) {
      resolve(
        browser.runtime.sendMessage({
          [MsgIdentifier]: 1,
          id,
          data,
          sender,
          destination,
        }),
      )

      return
    }

    resolve(
      browser.tabs.sendMessage(
        targetTabId!,
        {
          id,
          data,
          sender,
          destination,
          [MsgIdentifier]: 1,
        },
        targetFrameId === undefined ? undefined : { frameId: targetFrameId },
      ),
    )
  })
}

// FIXME: side effects
browser.runtime.onMessage.addListener(
  webextHandleMessage as Runtime.OnMessageListenerCallback,
)

/**
 * Handle message from runtime.onMessage
 */
export function webextHandleMessage(
  message: unknown,
  sender: Runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): true | Promise<unknown> | void {
  if (
    !message ||
    typeof message !== 'object' ||
    Reflect.get(message, MsgIdentifier) !== 1
  ) {
    return
  }

  asType<{
    id: MsgKey
    data: MsgData<MsgKey>
    /**
     * Forwarded message sender
     */
    sender?: Runtime.MessageSender
    destination?: 'sidebar' | 'content-script'
    [MsgIdentifier]?: 1
  }>(message)

  if (isBackground) {
    const res = handleForwardMessage(message, sender)
    if (res) {
      return res
    }
  }

  if (message.destination === 'sidebar' && !isSidepanel) {
    return
  }

  if (message.destination === 'content-script' && !isContentScript) {
    return
  }

  const id = message.id

  // Run all manual listeners
  const manualListeners = manualListenersMap.get(id)
  if (manualListeners) {
    for (const cb of manualListeners) {
      try {
        cb({
          id,
          data: message.data,
          sender,
          originalSender: message.sender,
          sendResponse,
        })
      } catch (e) {
        // ignore manual listener error
        // catch error to prevent runtime.onMessage from throwing
        console.error(e)
      }
    }
  }

  const listener = listenersMap.get(id)
  if (!listener) {
    return
  }

  // Run the listener
  Promise.try(listener, {
    id,
    data: message.data,
    sender,
    originalSender: message.sender,
    sendResponse: undefined,
  })
    .then((data) => ({ data }))
    .catch((error: unknown) => ({
      error: serializeError(
        error instanceof Error
          ? error
          : new Error('Unknown error', { cause: error }),
      ),
    }))
    .then(sendResponse)

  return true
}

export const onMessage = /* #__PURE__ */ new Proxy(
  /* #__PURE__ */ Object.create(null),
  { get: (_, p: MsgKey) => onMessageImpl.bind(null, p) },
) as {
  readonly [Key in keyof MessageProtocol]: {
    (
      callback: MsgCallback<true, ReadonlyDeep<MsgData<Key>>>,
      options: OnMsgOptions<true>,
    ): () => void
    (
      callback: MsgCallback<false, MsgData<Key>, MsgReturn<Key>>,
      options?: OnMsgOptions<boolean>,
    ): () => void
  }
}

export const sendMessage = /* #__PURE__ */ new Proxy(
  /* #__PURE__ */ Object.create(null),
  { get: (_, p: MsgKey) => sendMessageImpl.bind(null, p) },
) as {
  readonly [Key in keyof MessageProtocol]: <Data extends MsgData<Key>>(
    ...args: SendParams<Data>
  ) => Promise<MsgReturn<Key, Data>>
}
