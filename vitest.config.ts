import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage-report",
      include: ["src/**/*.ts"],
      thresholds: { lines: 80, branches: 80, "src/core/**": { lines: 90, branches: 90 } },
    },
  },
});
