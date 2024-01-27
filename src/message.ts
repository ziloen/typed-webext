import type { ErrorObject } from 'serialize-error'
import { deserializeError, serializeError } from 'serialize-error'
import type { IfNever, Promisable, ReadonlyDeep } from 'type-fest'
import type { Runtime } from 'webextension-polyfill'
import * as browser from "webextension-polyfill"
import type { MessageProtocol } from './index'
import { isTabsApiAvailable } from './utils'

const BackgroundForwardMessageId = '__webext_forward_tabs_message__'

const MessageIdentifierKey = '__webext_message_identifier__'

type Message<T> = {
  id: string
  /**
   * The sender of the message
   */
  sender: Runtime.MessageSender
  data: T
  /**
   * The original sender of the message if it is forwarded by background
   */
  originalSender?: Runtime.MessageSender | undefined
}

type MsgKey = keyof MessageProtocol
type MsgData<K extends MsgKey> = MessageProtocol[K][0]
type MsgReturn<K extends MsgKey> = MessageProtocol[K][1]

type MsgCallback<D = MsgData<MsgKey>, R = MsgReturn<MsgKey>> = (
  message: Message<D>
) => IfNever<R, void, Promisable<R>>

type PassiveCallback<D = MsgData<MsgKey>> = (message: Message<D>) => void

type Params<K extends MsgKey, D = MsgData<K>> = IfNever<
  D,
  [id: K, data?: undefined | null, options?: SendOptions],
  [id: K, data: D, options?: SendOptions]
>

type SendOptions = {
  tabId?: number | undefined | 'sender'
  frameId?: number | undefined | 'sender'
}

export async function sendMessage<K extends MsgKey>(...args: Params<K>) {
  const [id, data, options = {}] = args

  const tabId = options.tabId
  const frameId = options.frameId

  type Res = { data: MsgReturn<K> } | { error: ErrorObject } | null

  const res = await (
    tabId === undefined
      // No tabId, send directly to background
      ? browser.runtime.sendMessage({
        id,
        data,
        [MessageIdentifierKey]: 1,
      })
      : tabId !== 'sender' && frameId !== 'sender' && isTabsApiAvailable()
        // Send to tab and tabs API is available
        ? browser.tabs.sendMessage(
          tabId,
          { id, data, [MessageIdentifierKey]: 1 },
          frameId === undefined ? undefined : { frameId }
        )
        // Send to tab and tabs API is not available, forward by background
        : browser.runtime.sendMessage({
          id: BackgroundForwardMessageId,
          data: {
            tabId,
            frameId,
            id,
            data,
          },
          [MessageIdentifierKey]: 1,
        })
  ) as Res

  if (!res) {
    throw new Error(
      'null from runtime.sendMessage. Maybe multiple async runtime.onMessage listeners.'
    )
  }

  if (Object.hasOwn(res, 'error')) {
    throw deserializeError(res.error)
  }

  return res.data
}

const listenersMap = new Map<string, MsgCallback>()
const pasiveListenersMap = new Map<string, Set<PassiveCallback>>()

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
  passive?: false | undefined
): () => void
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
 *   true
 * )
 * ```
 */
export function onMessage<K extends MsgKey>(
  id: K,
  callback: PassiveCallback<ReadonlyDeep<MsgData<K>>>,
  passive: true
): () => void
export function onMessage<K extends MsgKey>(
  id: K,
  callback: MsgCallback<MsgData<K>, MsgReturn<K>>,
  passive = false
) {
  if (passive) {
    const listeners = pasiveListenersMap.get(id) ?? new Set()
    listeners.add(callback)
    pasiveListenersMap.set(id, listeners)
    return () => listeners.delete(callback)
  }

  const listener = listenersMap.get(id)
  if (listener) throw new Error(`Message ID "${id}" already has a listener.`)
  listenersMap.set(id, callback)
  return () => listenersMap.delete(id)
}

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
      [MessageIdentifierKey]?: 1
    }
    | undefined,
  sender: Runtime.MessageSender
) {
  if (message?.[MessageIdentifierKey] !== 1) return
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
        // catch error to prevent runtime.onMessage from throwing
        console.error(e)
      }
    }
  }

  // Run the listener
  const listener = listenersMap.get(id)
  if (!listener) return

  return Promise.resolve(listener({
    id,
    data: message.data,
    sender,
    originalSender: message.sender,
  }))
    .then(data => ({ data }))
    .catch((error: Error) => ({ error: serializeError(error) }))
}

export function backgroundForwardMessage() {
  type Msg =
    | {
      id?: string
      data?: unknown
      [MessageIdentifierKey]?: 1
    }
    | null
    | undefined

  browser.runtime.onMessage.addListener((
    message: Msg,
    sender
  ) => {
    if (message?.[MessageIdentifierKey] !== 1) return
    if (message?.id !== BackgroundForwardMessageId) return

    const { tabId, frameId, id, data } = message.data as {
      tabId: number | 'sender'
      frameId: number | undefined | 'sender'
      id: string
      data: unknown
    }

    const targetTabId = tabId === 'sender' ? sender.tab!.id! : tabId
    const targetFrameId = frameId === 'sender' ? sender.frameId : frameId

    return browser.tabs.sendMessage(
      targetTabId,
      {
        id,
        data,
        sender,
        [MessageIdentifierKey]: 1,
      },
      targetFrameId === undefined ? undefined : { frameId: targetFrameId }
    )
  })
}
