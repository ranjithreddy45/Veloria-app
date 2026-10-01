import { test, expect, type Page } from "@playwright/test";
import { ROLE_USERS, dismissTwoFactorBanner, signInAs, type SeededRole } from "./helpers";

// ============================================================
// Page actions as a restricted role (design spec R7).
//
// A pill in a page's "Page actions" cluster renders only for someone who can
// use its destination. Every other spec signs in as Super Admin, who can open
// everything, so a pill that dead-ends for a real role never shows up there.
// This spec signs in as seeded non-admin users, collects every link in each
// landing's cluster, opens it, and fails if it lands on /not-authorized, back
// on the landing (a page-level permission redirect), on /sign-in, or on the
// dashboard (where several pages send a role they refuse).
//
// `mustOffer` pins the create pills the role is entitled to, so an empty
// cluster can't pass by accident (a broken selector, or every pill filtered
// out for a role that holds the permission).
//
// It signs in with its own sessions and never touches the shared admin one.
// The 2FA strip FINANCE sees is dismissed for the session; 2FA is never
// enrolled. Kept apart from bd-leads.spec.ts and hr-reimbursement.spec.ts,
// which fail for reasons of their own.
// ============================================================

test.use({ storageState: { cookies: [], origins: [] } });

type Landing = {
  path: string;
  heading: string;
  /** Destinations the role holds the create permission for: their pills must be there. */
  mustOffer?: string[];
};

const CASES: { role: SeededRole; landings: Landing[] }[] = [
  {
    // bookings:read, tasks:read and contacts:read, but none of their creates.
    role: "STAFF",
    landings: [
      { path: "/bookings", heading: "Bookings" },
      { path: "/tasks", heading: "Tasks" },
      { path: "/contacts", heading: "Enquiry" },
    ],
  },
  {
    role: "SALES_EXEC",
    landings: [
      { path: "/leads", heading: "Leads", mustOffer: ["/leads/new", "/leads/import"] },
      { path: "/quotations", heading: "Quotations", mustOffer: ["/quotations/new"] },
    ],
  },
  {
    // leads:read without leads:create.
    role: "EVENT_COORDINATOR",
    landings: [{ path: "/leads", heading: "Leads" }],
  },
  {
    role: "FINANCE",
    landings: [
      { path: "/finance", heading: "Finance" },
      { path: "/invoices", heading: "Invoices", mustOffer: ["/invoices/new"] },
    ],
  },
];

/** Where a refused click ends up: never an acceptable destination for a pill. */
const BOUNCES = ["/not-authorized", "/sign-in", "/dashboard", "/"];

/** Open a URL and assert the app rendered it: an OK response, no 404 page, no error boundary. */
async function openRendered(page: Page, url: string): Promise<void> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  expect(status, `${url} responded ${status}`).toBeLessThan(400);
  await page.waitForLoadState("load");
  await expect(page.getByText("This page could not be found")).toHaveCount(0);
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
}

for (const { role, landings } of CASES) {
  test.describe(`Page actions as ${role}`, () => {
    test(`every pill on ${landings.map((l) => l.path).join(", ")} opens its destination`, async ({ page }) => {
      test.slow();
      const user = ROLE_USERS[role];

      await test.step(`sign in as ${user.email}`, async () => {
        await signInAs(page, user.email, user.password);
        await dismissTwoFactorBanner(page);
      });

      for (const landing of landings) {
        await test.step(landing.path, async () => {
          await openRendered(page, landing.path);
          // The role can open the landing itself; otherwise this case is wrong.
          expect(new URL(page.url()).pathname, `${role} could not open ${landing.path}`).toBe(landing.path);
          await expect(
            page.locator("#main-content").getByRole("heading", { level: 1, name: landing.heading }).first()
          ).toBeVisible();

          const hrefs = await page
            .locator('#main-content [aria-label="Page actions"] a[href]')
            .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href") ?? ""))]);
          test.info().annotations.push({
            type: `${role} ${landing.path}`,
            description: hrefs.length ? hrefs.join(", ") : "no page-action links",
          });

          for (const href of landing.mustOffer ?? []) {
            expect(hrefs, `${role} should be offered ${href} on ${landing.path}`).toContain(href);
          }

          for (const href of hrefs) {
            await openRendered(page, href);
            const landed = new URL(page.url()).pathname;
            const target = new URL(href, page.url()).pathname;
            expect(
              landed === target || (!BOUNCES.includes(landed) && landed !== landing.path),
              `${role}: the "${href}" pill on ${landing.path} bounced to ${landed}`
            ).toBe(true);
          }
        });
      }
    });
  });
}
