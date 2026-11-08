import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "test-output/**",
    "next-env.d.ts",
    "public/sw.js",
    "public/workbox-*.js",
  ]),
  {
    rules: {
      // New React Compiler rule (react-hooks v7, Next 16). Client hooks still load data and sync state
      // inside effects; migrating them is tracked in doc/TechnicalDebt.md. Keep it visible as a warning.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["src/lib/server/typedLocks.ts"],
    rules: {
      // Disable 'any' errors where it's required for the type system
      "@typescript-eslint/no-explicit-any": "off",
      // Allow unused variables with underscore prefix
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/__tests__/**/*.ts"],
    rules: {
      // Allow const instead of let suggestions in tests
      "prefer-const": "warn",
    },
  },
]);
