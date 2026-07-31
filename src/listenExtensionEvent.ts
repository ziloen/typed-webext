import { noop } from './util'

/**
 * @example
 * ```ts
 * import { listenExtensionEvent } from 'typed-webext'
 *
 * const ac = new AbortController()
 *
 * listenExtensionEvent(
 *   browser.runtime.onMessage,
 *   (message, sender) => {
 *     console.log('Received message:', message, 'from', sender)
 *   },
 *   { signal: ac.signal }
 * )
 *
 * // To stop listening, you can call:
 * ac.abort()
 * ```
 */
export function listenExtensionEvent<Callback extends (...args: any[]) => any>(
  target: chrome.events.Event<Callback>,
  callback: NoInfer<Callback>,
  options?: { signal?: AbortSignal },
): () => void {
  const signal = options?.signal

  if (signal?.aborted) {
    return noop
  }

  target.addListener(callback)

  const removeListener = () => target.removeListener(callback)

  if (signal) {
    signal.addEventListener('abort', removeListener, { once: true })

    return () => {
      removeListener()
      signal.removeEventListener('abort', removeListener)
    }
  }

  return removeListener
}
