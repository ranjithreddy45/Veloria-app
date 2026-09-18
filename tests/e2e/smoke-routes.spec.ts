import { test, expect } from "@playwright/test";

// Table-driven: each key dashboard route must render without tripping the
// (dashboard) error boundary ("Something went wrong"), a 404, or an auth
// bounce. Routes come from src/config/navigation.ts (SUPER_ADMIN sees all).
//
// Feature-flagged areas (FEATURES.hr → /people, /me/*) default ON; if a
// deployment turns one off, drop the row rather than the assertion.
const ROUTES: { path: string; heading?: string | RegExp }[] = [
  // Home
  { path: "/dashboard", heading: /Good (morning|afternoon|evening)/ },
  { path: "/my-work" },
  { path: "/playbook" },
  // Sales CRM
  { path: "/sales/dashboard" },
  { path: "/contacts" },
  { path: "/leads", heading: "Leads" },
  { path: "/leads/followups" },
  { path: "/inquiries" },
  { path: "/pipeline" },
  { path: "/quotations", heading: "Quotations" },
  { path: "/contracts" },
  { path: "/approvals" },
  { path: "/calendar" },
  // Bookings & venue
  { path: "/bookings", heading: "Bookings" },
  { path: "/bookings/calendar" },
  { path: "/availability" },
  { path: "/site-visits" },
  // BD / Acquisition
  { path: "/bd/dashboard" },
  { path: "/bd/leads", heading: "Leads" },
  { path: "/bd/deals" },
  { path: "/bd/properties" },
  { path: "/owners" },
  // Operations
  { path: "/tasks" },
  { path: "/vendors" },
  { path: "/beo" },
  { path: "/procurement" },
  { path: "/support" },
  { path: "/projects" },
  // People / HR
  { path: "/people", heading: "People" },
  { path: "/people/handbook", heading: "Employee Handbook" },
  { path: "/me/attendance" },
  { path: "/me/reimbursements", heading: "My reimbursements" },
  { path: "/me/approvals", heading: "My approvals" },
  { path: "/recruitment" },
  // Catalog & money
  { path: "/packages" },
  { path: "/pricing" },
  { path: "/invoices" },
  { path: "/payments" },
  { path: "/finance" },
  // Admin
  { path: "/settings" },
  { path: "/notifications" },
  // Customer app, the team's side (customer-app.spec.ts covers the journeys)
  { path: "/concierge", heading: "Customer Concierge" },
  { path: "/settings/business-contact", heading: "Business Contact" },
  { path: "/settings/customer-content", heading: "Customer Content" },
];

test.describe("Smoke — key dashboard routes render", () => {
  for (const route of ROUTES) {
    test(`${route.path} renders without an error boundary`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });

      // Redirect chains are followed; the final response must be OK.
      if (!response) throw new Error(`no response for ${route.path}`);
      const status = response.status();
      expect(status, `${route.path} responded ${status}`).toBeLessThan(400);

      // Never bounced to sign-in / not-authorized / 404.
      await expect(page).not.toHaveURL(/\/(sign-in|not-authorized)(\?|$)/);
      await expect(page.getByText("This page could not be found")).toHaveCount(0);

      // Client error boundary text (src/app/(dashboard)/error.tsx) — give
      // hydration a moment, then assert it never appeared.
      await page.waitForLoadState("load");
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Try Again" })).toHaveCount(0);

      // The app chrome rendered, i.e. we are inside the dashboard layout.
      await expect(page.getByRole("button", { name: "Sign out", exact: true }).first()).toBeAttached();

      if (route.heading) {
        await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      }
    });
  }
});
