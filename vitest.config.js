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
      // Source files that have unit tests. Kept explicit (rather than a broad
      // glob) so untested modules don't drag the coverage gate below threshold.
      include: [
        "src/**/*.{js,ts}",
        "db.js",
        "scripts/abandoned-cart-recovery.js",
      ],
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
