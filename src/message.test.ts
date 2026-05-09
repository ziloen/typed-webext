import { test } from 'vitest'
import type { sendMessage as sendMessageType } from './message'
import type { Expect, Equal } from './util'

declare const sendMessage: typeof sendMessageType

test('message type check', () => {})

async function typeOnlyTest() {
  const normal = await sendMessage.__test__('')

  type Normal = Expect<Equal<typeof normal, number>>

  const stringLiteral = await sendMessage.__test__string_literal('')

  type StringLiteral = Expect<Equal<typeof stringLiteral, 'A' | 'B'>>
}
