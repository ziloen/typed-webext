/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expectTypeOf, test } from 'vitest'
import type { getStorageLocal as TgetStorageLocal } from './storage'

const getStorageLocal = (() => {}) as unknown as typeof TgetStorageLocal

// type-challenges utils
/** @internal */
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false

/** @internal */
type Expect<T extends true> = T

test('getStorageLocal type tests', async () => {
  expectTypeOf<
    ReturnType<typeof getStorageLocal<'__test__string_literal', 'A' | 'B', 'A'>>
  >().toEqualTypeOf<Promise<'A' | 'B'>>()

  expectTypeOf<
    ReturnType<
      typeof getStorageLocal<'__test__string_array', string[], string[]>
    >
  >().toEqualTypeOf<Promise<string[]>>()

  expectTypeOf<
    ReturnType<
      // @ts-expect-error ts didn't recognize overloads
      typeof getStorageLocal<{
        readonly __test__string_literal: 'A'
        readonly __test__string_array: readonly []
      }>
    >
  >().toEqualTypeOf<
    Promise<{
      __test__string_literal: 'A' | 'B'
      __test__string_array: string[]
    }>
  >
})

async function typeOnlyTest() {
  const notExistKey = await getStorageLocal('__test__not_exist_key')
  type NotExistKey = Expect<Equal<typeof notExistKey, unknown>>

  const notExistKeyDefault = await getStorageLocal(
    '__test__not_exist_key',
    'default',
  )
  type NotExistKeyDefault = Expect<Equal<typeof notExistKeyDefault, string>>

  const stringLiteral = await getStorageLocal('__test__string_literal', 'A')
  type StringLiteral = Expect<Equal<typeof stringLiteral, 'A' | 'B'>>

  const stringArray = await getStorageLocal('__test__string_array', [])
  type StringArray = Expect<Equal<typeof stringArray, string[]>>

  const objectDefault = await getStorageLocal({
    __test__string_literal: 'A',
    __test__string_array: [],
  })
  type ObjectDefault = Expect<
    Equal<
      typeof objectDefault,
      { __test__string_literal: 'A' | 'B'; __test__string_array: string[] }
    >
  >
}
