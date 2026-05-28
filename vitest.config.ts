import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Only run our unit tests (pure logic). We deliberately scope to
    // *.test.ts so vitest doesn't try to load Next/React server files.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
