import { defineConfig } from "tsdown"

export default defineConfig({
  entry: [
    "src/index.ts",
  ],
  outDir: "dist",
  // minify: true,
  dts: true,
  format: ["esm"],
  platform: "node",
  treeshake: true,
  sourcemap: true,
  clean: true,
})