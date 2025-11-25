import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/react.ts'],
  outDir: 'dist',
  // minify: true,
  dts: {
    oxc: true,
  },
  // attachDebugInfo: "none",
  format: ['esm'],
  platform: 'node',
  treeshake: true,
  fixedExtension: false,
  sourcemap: true,
  clean: true,
})
