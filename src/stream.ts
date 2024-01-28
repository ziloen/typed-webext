import type { Runtime } from 'webextension-polyfill'
import type { StreamProtocol } from './index'
import * as browser from "webextension-polyfill"

const noop = (() => { }) as (...args: any[]) => void

type StreamKey = keyof StreamProtocol
type StreamData<K extends StreamKey> = StreamProtocol[K][0]
type StreamReturn<K extends StreamKey> = StreamProtocol[K][1]

/**
 * Stream interface for sending and receiving messages
 */
type Stream<SendData = unknown, MsgData = unknown> = {
  /**
   * The port connecting the two ends of the stream
   */
  port: Runtime.Port
  /**
   * signal for aborting the stream
   * 
   * @example
   * ```ts
   * onOpenStreamChannel('example', stream => {
   *   stream.onMessage(msg => {
   *     someApi(msg, { signal: stream.signal })
   *       .then((data) => stream.send({ data }))
   *       .catch((e: Error) => {
   *         if (e.name === "AbortError") return
   *         stream.send({ error: serializeError(e) })
   *       })
   *   })
   * })
   * ```
   */
  signal: AbortSignal
  /**
   * send data to another end
   */
  send(msg: SendData): void
  /**
   * close the stream
   */
  close(): void
  /**
   * listen to message from another end
   */
  onMessage(callback: (msg: MsgData) => void): () => void
  /**
   * listen to close event
   */
  onClose(callback: () => void): () => void
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
  iter(msg?: SendData): AsyncIterable<MsgData>
}

type StreamCallback<SendData, MsgData> = (
  stream: Stream<SendData, MsgData>
) => void

const listeners = new Map<string, StreamCallback<any, any>>()

/**
 * @private
 */
function createStream<T = unknown, K = unknown>(
  port: Runtime.Port
): Stream<T, K> {
  let connected = true
  const abortController = new AbortController()

  port.onDisconnect.addListener(() => {
    connected = false
    abortController.abort()
  })

  function onClose(callback: () => void) {
    port.onDisconnect.addListener(callback)
    return () => port.onDisconnect.removeListener(callback)
  }

  function onMessage(callback: (msg: K) => void) {
    port.onMessage.addListener(callback)
    return () => port.onMessage.removeListener(callback)
  }

  return {
    port,
    signal: abortController.signal,
    // avoid sending message after disconnect
    send: msg => connected && port.postMessage(msg),
    close: () => connected && port.disconnect(),
    onMessage,
    onClose,
    async *iter(...args) {
      let resolve: (value: K) => void

      const cleanupOnMessage = onMessage(msg => resolve(msg))
      const cleanupOnDisconnect = onClose(() => (resolve = noop))

      if (args.length) port.postMessage(args[0])

      try {
        while (true) {
          yield new Promise<K>(r => (resolve = r))
        }
      } finally {
        cleanupOnMessage()
        cleanupOnDisconnect()
      }
    },
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
export function onOpenStream<T extends StreamKey>(
  channel: T,
  callback: StreamCallback<StreamReturn<T>, StreamData<T>>
) {
  const listener = listeners.get(channel)
  if (listener) throw new Error(`Channel "${channel}" already has a listener.`)
  listeners.set(channel, callback)
  return () => listeners.delete(channel)
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
export function openStream<T extends StreamKey>(channel: T) {
  const port = browser.runtime.connect({ name: channel })
  return createStream<StreamData<T>, StreamReturn<T>>(port)
}

/**
 * Handle stream from runtime.onConnect
 */
export function webextHandleStream(port: Runtime.Port) {
  const channel = port.name
  const listener = listeners.get(channel)

  if (!listener) {
    console.error(`Channel "${channel}" has no listener.`)
    return
  }

  listener(createStream(port))
}

// side effects
if (
  browser.runtime.onConnect.hasListeners()
) {
  console.error(`runtime.onConnect has listeners, typed-webext/stream can't handle stream.`)
} else {
  browser.runtime.onConnect.addListener(webextHandleStream)
}


