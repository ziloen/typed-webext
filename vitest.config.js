import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    typecheck: {
      enabled: true,
      include: [...configDefaults.include],
      tsconfig: './tsconfig.json',
    },
  },
})
