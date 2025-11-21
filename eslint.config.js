// eslint.config.js
// Modern ESLint flat‑config version (v9+)
// Clean, compatible with Prettier and Node ESM setup

import js from "@eslint/js";
import globals from "globals";

export default [
  // Base recommended configuration from ESLint
  js.configs.recommended,

  {
    // ✅ Lint only JS source files, not assets or configs
    files: ["**/*.js"],

    // ✅ Folders / files ESLint should never lint
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

    // ✅ ECMAScript + global setup
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },

    // ✅ Rules tuned for your project
    rules: {
      // ---- General Hygiene ----
      "no-undef": "off",
      semi: ["warn", "always"],

      // ---- Unused variables ----
      // Warn only if actually worth fixing, ignore args and _vars
      "no-unused-vars": ["warn", { "args": "none", "varsIgnorePattern": "^_" }],

      // ---- Whitespace / spacing ----
      "no-irregular-whitespace": "off",
      "no-mixed-spaces-and-tabs": "off",
      "no-trailing-spaces": "off",

      // ---- Console / debugging ----
      "no-console": "off"
    }
  }
];