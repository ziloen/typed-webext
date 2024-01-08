import { defineConfig } from "tsup"

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/background-forward.ts",
  ],
  outDir: "dist",
  // minify: true,
  dts: true,
  format: ["esm"],
  clean: true,
})