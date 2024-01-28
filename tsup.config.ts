import { defineConfig } from "tsup"

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/background.ts",
    "src/message.ts",
    "src/storage.ts",
    "src/stream.ts"
  ],
  outDir: "dist",
  // minify: true,
  // dts: true,
  experimentalDts: true,
  format: ["esm"],
  treeshake: true,
  clean: true,
})