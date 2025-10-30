import type { Runtime } from 'webextension-polyfill'
import * as browser from 'webextension-polyfill'
import type { StreamProtocol } from './index'
import { asType, noop } from './util'

type StreamKey = keyof StreamProtocol
type StreamData<Key extends StreamKey> = StreamProtocol[Key][0]
type StreamReturn<Key extends StreamKey> = StreamProtocol[Key][1]

/**
 * Stream interface for sending and receiving messages
 */
export interface Stream<SendData = unknown, MsgData = unknown> {
  /**
   * The port connecting the two ends of the stream
   */
  port: Runtime.Port
  /**
   * signal for aborting the stream
   *
   * @example
   * ```ts
   * onOpenStream.example(({ signal, send, onMessage, close }) => {
   *   onMessage((msg) => {
   *     someApi(msg, { signal })
   *       .then((data) => send({ data }))
   *       .catch((e: Error) => {
   *         if (e.name === "AbortError") return
   *         send({ error: serializeError(e) })
   *       })
   *       .finally(close)
   *   })
   * })
   * ```
   */
  signal: AbortSignal
  /**
   * send data to another end
   */
  send: (msg: SendData) => void
  /**
   * close the stream
   */
  close: () => void
  /**
   * listen to message from another end
   */
  onMessage: (callback: (msg: MsgData) => void) => () => void
  /**
   * listen to close event
   */
  onClose: (callback: () => void) => () => void
  /**
   * async iterator for messages from another end
   *
   * @param [msg] initial message to send
   *
   * @example
   * ```ts
   * for await (const msg of stream.iter(data)) {
   *   console.log(msg)
   * }
   * ```
   */
  iter: (msg?: SendData) => AsyncIterable<MsgData>

  // [Symbol.dispose]
  // [Symbol.observable]
}

type StreamCallback<SendData, MsgData> = (
  stream: Stream<SendData, MsgData>,
) => void

const listeners = new Map<string, StreamCallback<any, any>>()

/**
 * @private
 */
function createStream<T = unknown, K = unknown>(
  port: Runtime.Port,
): Stream<T, K> {
  let connected = true
  const abortController = new AbortController()

  port.onDisconnect.addListener(() => {
    connected = false
    abortController.abort()
  })

  function onClose(callback: (port: Runtime.Port) => void) {
    port.onDisconnect.addListener(callback)
    return () =>
      browser.runtime.id && port.onDisconnect.removeListener(callback)
  }

  function onMessage(callback: (message: K, port: Runtime.Port) => void) {
    asType<(message: unknown, port: Runtime.Port) => void>(callback)
    port.onMessage.addListener(callback)
    return () => browser.runtime.id && port.onMessage.removeListener(callback)
  }

  return {
    port,
    signal: abortController.signal,
    send(msg) {
      // avoid sending message after disconnect
      if (connected) {
        port.postMessage(msg)
      }
    },
    close() {
      if (connected) {
        connected = false
        port.disconnect()
      }
    },
    onMessage,
    onClose,
    async *iter(...args) {
      let resolve: (value: K) => void

      const cleanupOnMessage = onMessage((msg) => resolve(msg))
      const cleanupOnDisconnect = onClose(() => (resolve = noop))

      if (args.length) port.postMessage(args[0])

      try {
        while (true) {
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          yield new Promise<K>((r) => (resolve = r))
        }
      } finally {
        cleanupOnMessage()
        cleanupOnDisconnect()
      }
    },
    // [Symbol.dispose]
    // [Symbol.observable]
  }
}

/**
 * @example
 * ```ts
 * const dispose = onOpenStream('example', (stream) => {
 *   stream.onMessage(async (msg) => {
 *     const data = await doSomething(msg)
 *     stream.send(data)
 *   })
 * })
 * ```
 */
function onOpenStreamImpl<T extends StreamKey>(
  channel: T,
  callback: StreamCallback<StreamReturn<T>, StreamData<T>>,
): () => void {
  const listener = listeners.get(channel)

  if (listener) throw new Error(`Channel "${channel}" already has a listener.`)
  listeners.set(channel, callback)
  return () => {
    listeners.delete(channel)
  }
}

export const onOpenStream = /* #__PURE__ */ new Proxy(
  /* #__PURE__ */ Object.create(null),
  { get: (_, p: StreamKey) => onOpenStreamImpl.bind(null, p) },
) as {
  [Key in keyof StreamProtocol]: (
    callback: StreamCallback<StreamReturn<Key>, StreamData<Key>>,
  ) => () => void
}

/**
 * Open a stream channel for sending and receiving messages
 *
 * @example
 * ```ts
 * const stream = openStream('example')
 *
 * stream.send('hello')
 *
 * const dispose = stream.onMessage((msg) => {
 *   console.log(msg)
 *   if (msg === "done") stream.close()
 * })
 *
 * for await (const msg of stream.iterator(data)) {
 *   console.log(msg)
 * }
 * ```
 */
function openStreamImpl<T extends StreamKey>(
  channel: T,
): Stream<StreamData<T>, StreamReturn<T>> {
  const port = browser.runtime.connect({ name: channel })
  return createStream(port)
}

export const openStream = /* #__PURE__ */ new Proxy(
  /* #__PURE__ */ Object.create(null),
  { get: (_, p: StreamKey) => openStreamImpl.bind(null, p) },
) as {
  [Key in keyof StreamProtocol]: () => Stream<
    StreamData<Key>,
    StreamReturn<Key>
  >
}

/**
 * Handle stream from runtime.onConnect
 */
export function webextHandleStream(port: Runtime.Port): void {
  const channel = port.name
  const listener = listeners.get(channel)

  if (!listener) {
    console.error(`Channel "${channel}" has no listener.`)
    return
  }

  listener(createStream(port))
}

// FIXME: side effects
browser.runtime.onConnect.addListener(webextHandleStream)
