/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/require-await */
import { expectTypeOf, test } from 'vitest'
import type { getStorageLocal } from './storage'


test('getStorageLocal type tests', async () => {
  expectTypeOf<ReturnType<typeof getStorageLocal<'__test__string_literal', 'A' | 'B', 'A'>>>().toEqualTypeOf<Promise<'A' | 'B'>>()

  expectTypeOf<ReturnType<typeof getStorageLocal<'__test__string_array', string[], string[]>>>().toEqualTypeOf<Promise<string[]>>()

  // @ts-expect-error ts didn't recognize overloads
  expectTypeOf<ReturnType<typeof getStorageLocal<{
    readonly __test__string_literal: 'A'
    readonly __test__string_array: readonly []
  }>>>().toEqualTypeOf<Promise<{
    __test__string_literal: 'A' | 'B'
    __test__string_array: string[]
  }>>
})