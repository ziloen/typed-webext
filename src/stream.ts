import { deserializeError, serializeError } from 'serialize-error'
import type { Runtime } from 'webextension-polyfill'
import * as browser from 'webextension-polyfill'
import type { StreamProtocol } from './index'

type StreamKey = keyof StreamProtocol
type StreamData<Key extends StreamKey> = StreamProtocol[Key][0]
type StreamReturn<Key extends StreamKey> = StreamProtocol[Key][1]

type DisposableCleanup = {
  (): void
  [Symbol.dispose]: () => void
}

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
   * send error to another end and immediately close the stream
   */
  error: (error: Error) => void
  /**
   * close the stream
   */
  close: () => void
  /**
   * listen to message from another end
   */
  onMessage: (callback: (msg: MsgData) => void) => DisposableCleanup
  /**
   * listen to error event
   */
  onError: (callback: (error: Error) => void) => DisposableCleanup
  /**
   * listen to close event
   */
  onClose: (callback: () => void) => DisposableCleanup
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

  // TODO:
  // onClose: (callback: (reason: 'error' | 'disconnect' | 'manual') => void) => () => void
}

function withDisposal(fn: (() => void) & { [Symbol.dispose]?: () => void }) {
  fn[Symbol.dispose] = fn
  return fn as DisposableCleanup
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
  const ac = new AbortController()

  port.onDisconnect.addListener(() => {
    connected = false
    ac.abort()
  })

  function close() {
    if (connected) {
      connected = false
      ac.abort()
      port.disconnect()
    }
  }

  function onClose(callback: (port: Runtime.Port) => void) {
    port.onDisconnect.addListener(callback)

    return withDisposal(() => {
      browser.runtime.id && port.onDisconnect.removeListener(callback)
    })
  }

  function onMessage(callback: (message: K, port: Runtime.Port) => void) {
    function wrappedCallback(message: unknown, p: Runtime.Port) {
      if (message && Object.hasOwn(message, 'data')) {
        callback(message.data as K, p)
      }
    }

    port.onMessage.addListener(wrappedCallback)

    return withDisposal(() => {
      browser.runtime.id && port.onMessage.removeListener(wrappedCallback)
    })
  }

  function onError(callback: (error: Error, port: Runtime.Port) => void) {
    function wrappedCallback(message: unknown, p: Runtime.Port) {
      if (message && Object.hasOwn(message, 'error')) {
        callback(deserializeError(message.error), p)
      }
    }

    // TODO: Can we just use onDisconnect + runtime.lastError?

    port.onMessage.addListener(wrappedCallback)

    return withDisposal(() => {
      browser.runtime.id && port.onMessage.removeListener(wrappedCallback)
    })
  }

  return {
    port,
    signal: ac.signal,
    send(msg) {
      // avoid sending message after disconnect
      if (connected) {
        port.postMessage({ data: msg })
      }
    },
    error(error: Error) {
      if (connected) {
        port.postMessage({ error: serializeError(error) })
        close()
      }
    },
    close,
    onMessage,
    onError,
    onClose,
    async *iter(...args) {
      type QueueItem<K> =
        | { type: 'DATA'; value: K }
        | { type: 'DONE'; value: null }
        | { type: 'ERROR'; value: Error }

      const queue: QueueItem<K>[] = []

      let resolve: (() => void) | null = null

      const enqueue = (item: QueueItem<K>) => {
        queue.push(item)
        if (resolve) {
          resolve()
          resolve = null
        }
      }

      using m = onMessage((msg) => enqueue({ type: 'DATA', value: msg }))
      using c = onClose(() => enqueue({ type: 'DONE', value: null }))
      using e = onError((err) => enqueue({ type: 'ERROR', value: err }))

      if (args.length) port.postMessage({ data: args[0] })

      while (true) {
        if (queue.length === 0) {
          // eslint-disable-next-line no-await-in-loop, @typescript-eslint/no-loop-func
          await new Promise<void>((r) => (resolve = r))
        }

        while (queue.length > 0) {
          const item = queue.shift()!
          if (item.type === 'DATA') {
            yield item.value
          } else if (item.type === 'DONE') {
            return
          } else if (item.type === 'ERROR') {
            throw item.value
          }
        }
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
