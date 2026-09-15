import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// ============================================================
// Playwright end-to-end smoke suite.
//
// Run against a server that is already up (default) …
//   pnpm test:e2e                     → http://localhost:3000
//   E2E_BASE_URL=https://beta.… pnpm test:e2e
//
// … or let Playwright boot `pnpm start` on an existing `next build`:
//   E2E_USE_WEBSERVER=1 pnpm test:e2e
//
// Auth: tests/e2e/global-setup.ts signs in once as the seeded SUPER_ADMIN
// and saves cookies + localStorage (welcome tour marked seen) to
// tests/e2e/.auth/admin.json. Every spec starts already signed in unless it
// opts out with `test.use({ storageState: { cookies: [], origins: [] } })`.
// ============================================================

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const useWebServer = process.env.E2E_USE_WEBSERVER === "1";
const isCI = !!process.env.CI;

// All generated artefacts live under tests/e2e/.* so the folder's own
// .gitignore covers them (root .gitignore is untouched).
const e2eDir = path.resolve(process.cwd(), "tests/e2e");
const storageState = path.join(e2eDir, ".auth/admin.json");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  outputDir: path.join(e2eDir, ".results"),
  globalSetup: "./tests/e2e/global-setup.ts",

  timeout: 60_000,
  expect: { timeout: 15_000 },

  // Specs create their own uniquely-named data, but a `next dev` server
  // compiling three routes at once is slow enough to trip timeouts, so run
  // one file at a time by default. Bump with `--workers=3` against a prod build.
  fullyParallel: false,
  workers: 1,
  retries: 1,
  forbidOnly: isCI,

  reporter: isCI
    ? [["list"], ["html", { open: "never", outputFolder: path.join(e2eDir, ".report") }]]
    : [["list"], ["html", { open: "on-failure", outputFolder: path.join(e2eDir, ".report") }]],

  use: {
    baseURL,
    storageState,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    // The seeded data + copy are Indian-English; keep the browser matching.
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } },
    },
  ],

  webServer: useWebServer
    ? {
        // Serves the existing `.next` build. next.config.ts has
        // `output: "standalone"`; `next start` still works with it (it just
        // prints a warning), and it keeps /public + /_next/static wired
        // without the standalone copy-steps the Dockerfile does.
        command: "pnpm start",
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
      }
    : undefined,
});
