import { defineConfig } from "tsup"

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/message.ts",
    "src/storage.ts",
    "src/stream.ts"
  ],
  outDir: "dist",
  // minify: true,
  dts: true,
  format: ["esm"],
  platform: "node",
  bundle: false,
  treeshake: true,
  sourcemap: true,
  clean: true,
})