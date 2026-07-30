import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // Flat config has no .eslintignore — ignores live here or nothing is
    // excluded. Build output and vendored artifacts must not be linted.
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "graphify-out/**",
      "public/**",
      ".remember/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
      "*.log",
    ],
  },

  ...compat.extends("next/core-web-vitals"),

  // next/typescript loads @typescript-eslint. Without it, every
  // `eslint-disable @typescript-eslint/no-explicit-any` in the codebase was
  // an error ("Definition for rule ... was not found") rather than a
  // suppression, and the CLAUDE.md ban on `any` was never enforced by
  // anything. The packages ship with eslint-config-next — no new dependency.
  ...compat.extends("next/typescript"),

  {
    rules: {
      // CLAUDE.md §6: "No `any`." Warn rather than error for now — there are
      // ~20 pre-existing occurrences. Raise to "error" once they're burned
      // down so the gate blocks new ones.
      "@typescript-eslint/no-explicit-any": "warn",

      // Server actions legitimately declare unused `_prev` params to satisfy
      // the useActionState signature.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    // Tests and one-off scripts are looser by design.
    files: ["__tests__/**", "**/__tests__/**", "scripts/**", "*.config.*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    // Plain .js files here are legacy CommonJS node one-offs (scripts/,
    // setup-analytics.js, check-db-tables.js). They are not TypeScript and
    // `require()` is correct for them — judging them by the TS ruleset
    // produced 127 of the 182 findings on first run, all noise. New code is
    // TypeScript per CLAUDE.md §3, so this exemption should not grow.
    files: ["**/*.js", "**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
];

export default eslintConfig;
