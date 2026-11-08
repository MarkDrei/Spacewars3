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
  ]),
  {
    // Type-aware rules: a promise must be awaited, handled (.catch / .then with rejection
    // handler) or explicitly marked as fire-and-forget with `void`. An un-awaited promise runs
    // detached: callers continue before it finishes and try/catch does not see its errors.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
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
