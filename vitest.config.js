// vitest.config.js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.{js,ts}"],

    // ✅ Coverage options
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{js,ts}"], // Only your source files
      all: true, // Include untested files
      thresholds: {
        // Coverage thresholds enforcement
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
