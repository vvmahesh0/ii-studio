import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".alpha-bench-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/vendor/**",
    "tools/figma-adapter-poc/vendor/**",
    "tools/figma-adapter-poc/plugin/code.js",
    "tools/figma-adapter-poc/evidence/**",
  ]),
]);

export default eslintConfig;
