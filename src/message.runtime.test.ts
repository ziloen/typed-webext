import { afterEach, describe, expect, test, vi } from 'vitest'

declare module './' {
  interface MessageProtocol<T = unknown> {
    /** @internal */
    __runtime_test: [data: string, result: number]
    /** @internal */
    '__forward_runtime-test-extension': [data: unknown, result: number]
  }
}

const extensionId = 'runtime-test-extension'
const messageIdentifier = `__${extensionId}`
const forwardMessageId = `__forward_${extensionId}`

function createBrowserMock(contentScript = false) {
  return {
    runtime: {
      id: extensionId,
      getManifest: vi.fn(() => ({})),
      onMessage: {
        addListener: vi.fn(),
      },
    },
    tabs: contentScript ? {} : { sendMessage: vi.fn() },
  }
}

function createSender(tabId?: number): chrome.runtime.MessageSender {
  if (tabId === undefined) return {}
  return { tab: { id: tabId } as chrome.tabs.Tab }
}

async function loadMessage(contentScript = false) {
  vi.resetModules()
  const browserMock = createBrowserMock(contentScript)
  vi.stubGlobal('browser', browserMock)

  return {
    browserMock,
    messageModule: await import('./message'),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('webextHandleMessage', () => {
  test('runs matching manual listeners before the regular listener', async () => {
    const { messageModule } = await loadMessage()
    const calls: string[] = []
    const error = new Error('manual listener failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const erroringManualListener = vi.fn(() => {
      calls.push('manual-error')
      throw error
    })
    const matchingManualListener = vi.fn(() => {
      calls.push('manual-match')
    })
    const skippedManualListener = vi.fn(() => {
      calls.push('manual-skip')
    })
    const regularListener = vi.fn(() => {
      calls.push('regular')
      return 3
    })

    messageModule.onMessage.__runtime_test(erroringManualListener, {
      manual: true,
      tabId: 7,
    })
    messageModule.onMessage.__runtime_test(matchingManualListener, {
      manual: true,
      tabId: 7,
    })
    messageModule.onMessage.__runtime_test(skippedManualListener, {
      manual: true,
      tabId: 8,
    })
    messageModule.onMessage.__runtime_test(regularListener, { tabId: 7 })

    const sendResponse = vi.fn()
    const result = messageModule.webextHandleMessage(
      {
        _id: messageIdentifier,
        id: '__runtime_test',
        data: 'abc',
        sender: { tab: { id: 99 } },
      },
      createSender(7),
      sendResponse,
    )

    expect(result).toBe(true)
    expect(erroringManualListener).toHaveBeenCalledOnce()
    expect(matchingManualListener).toHaveBeenCalledOnce()
    expect(skippedManualListener).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(error)

    await vi.waitFor(() => {
      expect(calls).toEqual(['manual-error', 'manual-match', 'regular'])
      expect(sendResponse).toHaveBeenCalledWith({ data: 3 })
    })
  })

  test('uses the forwarded sender when running in a content script', async () => {
    const { messageModule } = await loadMessage(true)
    const listener = vi.fn(({ data }: { data: string }) => data.length)
    messageModule.onMessage.__runtime_test(listener, { tabId: 42 })

    const sendResponse = vi.fn()
    const result = messageModule.webextHandleMessage(
      {
        _id: messageIdentifier,
        id: '__runtime_test',
        data: 'content',
        destination: 'content-script',
        sender: { tab: { id: 42 } },
      },
      createSender(7),
      sendResponse,
    )

    expect(result).toBe(true)
    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledOnce()
      expect(sendResponse).toHaveBeenCalledWith({ data: 7 })
    })

    const unmatchedResponse = vi.fn()
    const unmatchedResult = messageModule.webextHandleMessage(
      {
        _id: messageIdentifier,
        id: '__runtime_test',
        data: 'ignored',
        destination: 'content-script',
        sender: { tab: { id: 99 } },
      },
      createSender(42),
      unmatchedResponse,
    )

    expect(unmatchedResult).toBeUndefined()
    expect(listener).toHaveBeenCalledOnce()
    expect(unmatchedResponse).not.toHaveBeenCalled()
  })

  test('keeps the asynchronous error response contract', async () => {
    const { messageModule } = await loadMessage()
    const listener = vi.fn(() => {
      throw new Error('listener failed')
    })
    messageModule.onMessage.__runtime_test(listener)

    const sendResponse = vi.fn()
    const result = messageModule.webextHandleMessage(
      {
        _id: messageIdentifier,
        id: '__runtime_test',
        data: 'abc',
      },
      createSender(),
      sendResponse,
    )

    expect(result).toBe(true)
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledOnce()
      const response: unknown = sendResponse.mock.calls[0]?.[0]
      expect(response).toMatchObject({
        error: { message: 'listener failed' },
      })
    })
  })

  test('returns a background forward before local message routing', async () => {
    vi.resetModules()
    const backgroundWindow = {}
    const browserMock = {
      ...createBrowserMock(),
      extension: {
        getBackgroundPage: vi.fn(() => backgroundWindow),
      },
    }
    vi.stubGlobal('window', backgroundWindow)
    vi.stubGlobal('browser', browserMock)
    const messageModule = await import('./message')

    const manualListener = vi.fn()
    const regularListener = vi.fn(() => 1)
    messageModule.onMessage[forwardMessageId](manualListener, { manual: true })
    messageModule.onMessage[forwardMessageId](regularListener)

    const sender = createSender(7)
    const sendResponse = vi.fn()
    const result = messageModule.webextHandleMessage(
      {
        _id: messageIdentifier,
        id: forwardMessageId,
        destination: 'sidebar',
        data: {
          tabId: 12,
          frameId: undefined,
          id: '__runtime_test',
          data: 'forwarded',
          destination: 'sidebar',
        },
      },
      sender,
      sendResponse,
    )

    expect(result).toBeInstanceOf(Promise)
    await result
    expect(browserMock.tabs.sendMessage).toHaveBeenCalledWith(
      12,
      {
        _id: messageIdentifier,
        id: '__runtime_test',
        data: 'forwarded',
        sender,
        destination: 'sidebar',
      },
      undefined,
    )
    expect(manualListener).not.toHaveBeenCalled()
    expect(regularListener).not.toHaveBeenCalled()
    expect(sendResponse).not.toHaveBeenCalled()
  })
})
