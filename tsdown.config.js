import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/react.ts'],
  outDir: 'dist',
  dts: {
    generator: 'oxc',
  },
  inputOptions: {
    experimental: {
      attachDebugInfo: 'none',
    },
  },
  outputOptions: {
    comments: false,
  },
  format: ['esm'],
  platform: 'node',
  treeshake: true,
  fixedExtension: false,
  clean: true,
  target: 'es2023',
})
