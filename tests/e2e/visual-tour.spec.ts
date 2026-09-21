import path from "node:path";
import { test, expect } from "@playwright/test";

// ============================================================
// A visual tour, not a pixel diff.
//
// The team app was restyled across several hundred screens at once, and the
// people doing it had no database to run it against. This spec is how anyone
// can LOOK at the result: it walks a spread of real screens against the seeded
// CI database and saves a screenshot of each, in light and dark and at phone
// width. The workflow uploads the folder on every run.
//
// It asserts only what a restyle can plausibly break without anyone noticing
// in code review:
//   - the page is not sliding sideways (a glass toolbar or wide card pushing
//     the document past the viewport);
//   - the page's main heading is actually visible, i.e. nothing opaque is
//     sitting on top of the content.
// Whether it looks GOOD is a human call — that is what the pictures are for.
// ============================================================

const SHOTS = path.join(__dirname, "visual-tour-shots");

/** One screen from each family of layout: home, list, board, calendar, detail-heavy, settings, ops, finance, HR. */
const SCREENS: { name: string; path: string }[] = [
  { name: "home", path: "/dashboard" },
  { name: "sales-dashboard", path: "/sales/dashboard" },
  { name: "leads", path: "/leads" },
  { name: "pipeline", path: "/pipeline" },
  { name: "bookings", path: "/bookings" },
  { name: "calendar", path: "/calendar" },
  { name: "quotations", path: "/quotations" },
  { name: "invoices", path: "/invoices" },
  { name: "bd-deals", path: "/bd/deals" },
  { name: "beo", path: "/beo" },
  { name: "kitchen", path: "/kitchen" },
  { name: "vendors", path: "/vendors" },
  { name: "people", path: "/people" },
  { name: "reports", path: "/reports" },
  { name: "settings", path: "/settings" },
];

const MODES = [
  { id: "desktop-light", viewport: { width: 1440, height: 900 }, scheme: "light" as const },
  { id: "desktop-dark", viewport: { width: 1440, height: 900 }, scheme: "dark" as const },
  { id: "phone-light", viewport: { width: 390, height: 844 }, scheme: "light" as const },
];

for (const mode of MODES) {
  test.describe(`visual tour · ${mode.id}`, () => {
    test.use({ viewport: mode.viewport, colorScheme: mode.scheme });

    for (const screen of SCREENS) {
      test(`${screen.name}`, async ({ page }) => {
        // The app's theme follows a class on <html> via next-themes; seed its
        // storage key so dark mode is real, not just the media query.
        await page.addInitScript((scheme) => {
          try {
            window.localStorage.setItem("theme", scheme);
          } catch {
            /* storage may be unavailable; the media query still applies */
          }
        }, mode.scheme);

        const response = await page.goto(screen.path, { waitUntil: "networkidle" });
        expect(response?.status(), `${screen.path} should load`).toBeLessThan(400);

        // Entrance animations settle before the picture is taken.
        await page.waitForTimeout(600);

        const main = page.locator("#main-content");
        await expect(main).toBeVisible();

        // Nothing opaque over the content: the first heading can be seen.
        const heading = main.getByRole("heading").first();
        if ((await heading.count()) > 0) await expect(heading).toBeVisible();

        // The document itself must not scroll sideways. Tables scroll inside
        // their own box; 2px of slack covers sub-pixel rounding.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        expect(overflow, `${screen.path} overflows the viewport by ${overflow}px`).toBeLessThanOrEqual(2);

        await page.screenshot({
          path: path.join(SHOTS, mode.id, `${screen.name}.png`),
          fullPage: false,
        });
      });
    }
  });
}
