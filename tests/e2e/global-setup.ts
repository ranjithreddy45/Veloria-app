import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ADMIN, WELCOME_TOUR_SEEN_KEY, storageStatePath } from "./helpers";

// ============================================================
// Signs in ONCE as the seeded SUPER_ADMIN and persists the session
// (cookies) plus localStorage (welcome tour marked as seen) so every spec
// starts on an authenticated, tour-free dashboard.
//
// Runs after `webServer` is up (Playwright orders it that way), so the
// app is reachable at config.use.baseURL by the time we get here.
// ============================================================

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use.baseURL ??
    process.env.E2E_BASE_URL ??
    "http://localhost:3000";

  const file = storageStatePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  try {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await page.locator("input[type=email]").fill(ADMIN.email);
    await page.locator("input[type=password]").fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // A wrong password stays on /sign-in with a toast; surface that clearly
    // instead of letting every spec fail on a redirect-to-sign-in.
    await page
      .waitForURL(/\/dashboard/, { timeout: 90_000 })
      .catch(async () => {
        const toast = await page
          .locator("[data-sonner-toast]")
          .first()
          .textContent()
          .catch(() => null);
        throw new Error(
          `E2E global setup could not sign in as ${ADMIN.email} at ${baseURL}. ` +
            `Still on ${page.url()}${toast ? ` — toast: "${toast.trim()}"` : ""}. ` +
            "Is the server up and the DB seeded (pnpm db:seed)?"
        );
      });

    // Welcome tour is gated purely by this localStorage key (see
    // src/app/(dashboard)/dashboard/_components/welcome-tour.tsx). Storage
    // state captures localStorage per origin, so marking it here means no
    // spec ever has to dismiss the dialog. helpers.dismissTour() remains as
    // a belt-and-braces fallback for fresh contexts.
    await page.evaluate((key) => {
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* private mode — dismissTour() handles it */
      }
    }, WELCOME_TOUR_SEEN_KEY);

    await page.context().storageState({ path: file });
  } finally {
    await browser.close();
  }
}
