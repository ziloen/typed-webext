import { test } from 'vitest'
import { onMessage, type sendMessage as sendMessageType } from './message'
import type { Equal, Expect } from './util'

declare module './' {
  interface MessageProtocol<T = unknown> {
    /** @internal */
    __test: [data: string, result: number]
    /** @internal */
    __test__string_literal: [data: string, result: 'A' | 'B']
    /** @internal */
    __test_void: [data: string | void, result: never]
  }
}

declare const sendMessage: typeof sendMessageType

test('message type check', () => {})

async function typeOnlyTest() {
  const _normal = await sendMessage.__test('')

  type _Normal = Expect<Equal<typeof _normal, number>>

  onMessage.__test(() => 0)
  // @ts-expect-error return type should be number
  onMessage.__test(() => '')

  // @ts-expect-error return type should be number
  // eslint-disable-next-line no-empty-pattern
  onMessage.__test(({}) => {
    //               ^ Expect IntelliSense here
    // type _Data = Expect<Equal<typeof data, string>>

    return ''
  })

  // @ts-expect-error data should be string
  sendMessage.__test(123)

  const _stringLiteral = await sendMessage.__test__string_literal('')

  type _StringLiteral = Expect<Equal<typeof _stringLiteral, 'A' | 'B'>>

  onMessage.__test_void(({ data }) => {
    type _Void = Expect<Equal<typeof data, void | string | undefined>>
  })

  await sendMessage.__test_void()
  await sendMessage.__test_void('')
}
