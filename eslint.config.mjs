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
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prebuilt three.js decoders, vendored alongside their .wasm payloads.
    // Upstream bundles we do not edit, so linting them only produces noise.
    "public/draco/**",
    "public/basis/**",
  ]),
]);

export default eslintConfig;
