import { typescript } from "@ziloen/eslint-config"

/** @type {import("@ziloen/eslint-config").FlatESLintConfig[]} */
export default [
  ...typescript({ tsconfigPath: "./tsconfig.json" })
]