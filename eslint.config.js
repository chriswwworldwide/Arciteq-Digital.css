// eslint.config.js
// -------------------------------------------------------------
// Modern ESLint flat‑config (for ESLint v9+)
// Works seamlessly in ESM projects (package.json → "type": "module")
// Compatible with Prettier and modern toolchains
// -------------------------------------------------------------

import js from "@eslint/js";
import globals from "globals";

export default [
  // ✅ Base ESLint recommended rules
  js.configs.recommended,

  {
    // ✅ Apply rules only to JavaScript source files
    files: ["**/*.js"],

    // ✅ Skip non‑source or generated directories
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "public/**",
      "themes/**",
      "backups_*/**",
      "public_backup_*/**",
      "**/*.min.js",
      "**/*.bundle.js",
      "**/*.json",
      "**/*.html",
      "eslint.config.js"
    ],

    // ✅ Language and environment setup
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },

    // ✅ Custom rules
    rules: {
      // ---- General Hygiene ----
      "no-undef": "off",
      semi: ["warn", "always"],

      // ---- Unused variables ----
      // Warn on truly unused variables, ignore args and leading underscores
      "no-unused-vars": [
        "warn",
        { args: "none", varsIgnorePattern: "^_" }
      ],

      // ---- Whitespace / spacing issues ----
      "no-irregular-whitespace": "off",
      "no-mixed-spaces-and-tabs": "off",
      "no-trailing-spaces": "off",

      // ---- Console / debugging ----
      "no-console": "off"
    }
  }
];