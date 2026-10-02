import { test, expect, type Locator, type Page, type Request } from "@playwright/test";
import {
  TOUR_SCREENS,
  dismissTwoFactorBanner,
  measurePageHeader,
  measureSkeletonTitle,
  settleLayout,
  type PageHeaderGeometry,
} from "./helpers";

// ============================================================
// Header geometry: the page-header rules, measured on real screens.
//
// The visual tour takes pictures; this spec measures the same screens so the
// header layout can't drift silently (design spec R1, R2, R5, R10, R11, R15):
//
//   1440px  - every page shows exactly one module chip and an eyebrow, and
//             the chip, the h1 and the eyebrow sit at the same x on every
//             route (one left edge, no 54px title jump between sibling pages);
//           - the "Page actions" cluster, when there is one, is fully on
//             screen and no pill is clipped (focus ring included).
//   390px   - no chip, the h1 starts at the 16px gutter, and every pill sits
//             inside [16, 374].
//   loading - on a client navigation to /bookings, /bd/dashboard, a package
//             record and a function sheet, the skeleton's title box sits
//             where the settled h1 lands, at 1440px and at 390px.
//
// Routes: every visual-tour screen except /dashboard, which is the hub and
// has its own header with no module chip (its pill row gets a 390px check of
// its own: every pill on screen, at most three rows). That list already
// includes /leads, /pipeline and /bd/deals. One test per width walks all of
// them, so the cross-route comparison happens in one place; each route's
// problems are soft assertions, reported together at the end, and the
// measurements are attached to the report as JSON.
// ============================================================

const ROUTES = TOUR_SCREENS.map((s) => s.path).filter((p) => p !== "/dashboard");

/** Sub-pixel rounding between routes. */
const SAME_X = 1;
/** The global focus outline reaches 4px past an element: 2px wide at a 2px offset (globals.css). */
const RING = 4;

/** Open a route and measure its header. Null (after a soft failure) when its h1 never renders. */
async function openAndMeasure(page: Page, route: string): Promise<PageHeaderGeometry | null> {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  expect.soft(status, `${route} responded ${status}`).toBeLessThan(400);
  expect.soft(new URL(page.url()).pathname, `${route} redirected`).toBe(route);

  const h1 = page.locator("#main-content h1").first();
  const shown = await h1.waitFor({ state: "visible", timeout: 30_000 }).then(
    () => true,
    () => false
  );
  expect.soft(shown, `${route}: no visible h1 in #main-content`).toBe(true);
  if (!shown) return null;

  await page.waitForLoadState("load");
  await settleLayout(page);
  return page.evaluate(measurePageHeader, RING);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`;

test.describe("header geometry · 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("one chip per page, one left edge, the same h1 x on every route, nothing clipped", async ({ page }) => {
    test.setTimeout(10 * 60_000);
    const rows: { route: string; geometry: PageHeaderGeometry }[] = [];

    for (const route of ROUTES) {
      await test.step(route, async () => {
        const g = await openAndMeasure(page, route);
        if (!g) return;
        rows.push({ route, geometry: g });

        // R2: exactly one module chip, at the content edge.
        expect.soft(g.visibleChips, `${route}: visible module chips`).toBe(1);
        // R1/R15: every header has an eyebrow above its title row (the page's
        // own or, when it passes none, the module's name). The loading
        // skeletons put their title box under one, so a header without it
        // makes the title jump up when the page lands.
        expect.soft(g.eyebrow, `${route}: no eyebrow above the title row`).not.toBeNull();
        if (!g.chip || !g.h1) return;
        expect.soft(Math.abs(g.chip.left - g.contentLeft), `${route}: chip x ${px(g.chip.left)}, content edge ${px(g.contentLeft)}`).toBeLessThanOrEqual(SAME_X);

        // R1: one left edge. The eyebrow and the description start where the
        // chip does: the chip is in the title row, not in a column of its own.
        if (g.eyebrow) {
          expect.soft(Math.abs(g.eyebrow.left - g.chip.left), `${route}: eyebrow x ${px(g.eyebrow.left)}, chip x ${px(g.chip.left)}`).toBeLessThanOrEqual(SAME_X);
        }
        if (g.description) {
          expect.soft(Math.abs(g.description.left - g.chip.left), `${route}: description x ${px(g.description.left)}, chip x ${px(g.chip.left)}`).toBeLessThanOrEqual(SAME_X);
        }
        expect.soft(g.h1.left, `${route}: the h1 must start right of the chip`).toBeGreaterThan(g.chip.right);

        // R5/R11: the cluster is on screen and nothing in it is clipped, its
        // focus ring included.
        for (const list of g.lists) {
          expect.soft(list.box.left, `${route}: "Page actions" starts off screen`).toBeGreaterThanOrEqual(-SAME_X);
          expect.soft(list.box.right, `${route}: "Page actions" ends at ${px(list.box.right)}, past the ${g.viewportWidth}px viewport`).toBeLessThanOrEqual(g.viewportWidth + SAME_X);
          for (const item of list.items) {
            const onScreen = item.box.left >= -SAME_X && item.box.right <= g.viewportWidth + SAME_X;
            expect.soft(onScreen, `${route}: "${item.label}" is cut by the viewport`).toBe(true);
            expect.soft(item.clippedBy, `${route}: "${item.label}" is clipped by an ancestor`).toBeNull();
          }
        }
      });
    }

    await test.info().attach("header-geometry-1440.json", {
      body: JSON.stringify(rows, null, 2),
      contentType: "application/json",
    });

    // The cross-route rule: the chip and the h1 start at the same x on every
    // page, whatever module it belongs to. Every h1 is compared, chip or not,
    // so a page that lost its chip shows up as the title jump it causes.
    const chips = rows.flatMap(({ route, geometry: g }) => (g.chip ? [{ route, x: g.chip.left }] : []));
    const h1s = rows.flatMap(({ route, geometry: g }) => (g.h1 ? [{ route, x: g.h1.left }] : []));
    expect(h1s.length, "routes with an h1 to compare").toBeGreaterThan(1);
    const chipX = median(chips.map((c) => c.x));
    const h1X = median(h1s.map((h) => h.x));
    for (const c of chips) {
      expect.soft(Math.abs(c.x - chipX), `${c.route}: chip x ${px(c.x)}, the other routes ${px(chipX)}`).toBeLessThanOrEqual(SAME_X);
    }
    for (const h of h1s) {
      expect.soft(Math.abs(h.x - h1X), `${h.route}: h1 x ${px(h.x)}, the other routes ${px(h1X)}`).toBeLessThanOrEqual(SAME_X);
    }
  });
});

test.describe("header geometry · 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /** The phone gutter (#main-content px-4), and the last x a pill may reach. */
  const GUTTER = 16;
  const RIGHT_LIMIT = 390 - GUTTER;

  test("no chip, the title at the 16px gutter, every pill inside the gutters", async ({ page }) => {
    test.setTimeout(10 * 60_000);
    const rows: { route: string; geometry: PageHeaderGeometry }[] = [];

    for (const route of ROUTES) {
      await test.step(route, async () => {
        const g = await openAndMeasure(page, route);
        if (!g) return;
        rows.push({ route, geometry: g });

        // R2/R10: the chip is hidden below sm, so the title takes the gutter.
        expect.soft(g.visibleChips, `${route}: module chips visible at 390px`).toBe(0);
        expect.soft(g.eyebrow, `${route}: no eyebrow above the title row`).not.toBeNull();
        if (!g.h1) return;
        expect.soft(Math.abs(g.h1.left - GUTTER), `${route}: h1 x ${px(g.h1.left)}, expected ${GUTTER}px`).toBeLessThanOrEqual(SAME_X);
        if (g.eyebrow) {
          expect.soft(Math.abs(g.eyebrow.left - GUTTER), `${route}: eyebrow x ${px(g.eyebrow.left)}, expected ${GUTTER}px`).toBeLessThanOrEqual(SAME_X);
        }
        if (g.description) {
          expect.soft(Math.abs(g.description.left - GUTTER), `${route}: description x ${px(g.description.left)}, expected ${GUTTER}px`).toBeLessThanOrEqual(SAME_X);
        }

        // R10: the pills wrap; none is cut by the screen edge or the gutter.
        for (const list of g.lists) {
          for (const pill of list.pills) {
            expect.soft(pill.box.left, `${route}: "${pill.label}" starts at ${px(pill.box.left)}, left of the ${GUTTER}px gutter`).toBeGreaterThanOrEqual(GUTTER - SAME_X);
            expect.soft(pill.box.right, `${route}: "${pill.label}" ends at ${px(pill.box.right)}, past ${RIGHT_LIMIT}px`).toBeLessThanOrEqual(RIGHT_LIMIT + SAME_X);
            expect.soft(pill.clippedBy, `${route}: "${pill.label}" is clipped by an ancestor`).toBeNull();
          }
        }
      });
    }

    await test.info().attach("header-geometry-390.json", {
      body: JSON.stringify(rows, null, 2),
      contentType: "application/json",
    });
    expect(rows.length, "routes measured at 390px").toBeGreaterThan(1);
  });

  // The /dashboard hub is left out of the walk above (it has no module chip),
  // but its pill row gets a phone check of its own. It is the one exception to
  // R10's two-row limit: the owner chose to have all five hub pills wrap
  // rather than fold some into a menu, and five pills take three rows at
  // 390px. Every pill must still be on screen, inside the gutters.
  test("the /dashboard hub's pills wrap to at most three rows, inside the gutters", async ({ page }) => {
    test.slow();
    const g = await openAndMeasure(page, "/dashboard");
    if (!g) return;
    await test.info().attach("header-geometry-390-dashboard.json", {
      body: JSON.stringify(g, null, 2),
      contentType: "application/json",
    });

    expect(g.lists.length, "/dashboard: rendered \"Page actions\" lists").toBe(1);
    const pills = g.lists[0].pills;
    // The shared session is the seeded SUPER_ADMIN, who can open all five
    // destinations: on a phone all five stay visible pills, none in a menu.
    expect(pills.map((p) => p.label), "/dashboard: visible hub pills").toHaveLength(5);

    // A new row starts when a pill's top is clearly below the current row's
    // (more than half a pill), so sub-pixel differences never count as rows.
    let rows = 0;
    let rowTop = -Infinity;
    for (const top of pills.map((p) => p.box.top).sort((a, b) => a - b)) {
      if (top > rowTop + 20) {
        rows += 1;
        rowTop = top;
      }
    }
    expect(rows, `/dashboard: hub rows at 390px (${pills.map((p) => p.label).join(", ")})`).toBeLessThanOrEqual(3);

    for (const pill of pills) {
      expect.soft(pill.box.left, `/dashboard: "${pill.label}" starts at ${px(pill.box.left)}, left of the ${GUTTER}px gutter`).toBeGreaterThanOrEqual(GUTTER - SAME_X);
      expect.soft(pill.box.right, `/dashboard: "${pill.label}" ends at ${px(pill.box.right)}, past ${RIGHT_LIMIT}px`).toBeLessThanOrEqual(RIGHT_LIMIT + SAME_X);
      expect.soft(pill.clippedBy, `/dashboard: "${pill.label}" is clipped by an ancestor`).toBeNull();
    }
  });
});

/**
 * The loading check runs at both widths R15 names. Below md (768px, the
 * breakpoint in src/hooks/use-mobile.ts) the sidebar is an off-canvas sheet,
 * so the 390px run opens it from the header before reaching for its link.
 */
const LOADING_VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "390", width: 390, height: 844 },
] as const;
const SIDEBAR_SHEET_BELOW = 768;

/**
 * The routes whose loading skeleton is checked, each reached by a client
 * navigation the way a person gets there:
 *
 *   /bookings          the list skeleton with the two-line phone eyebrow
 *                      (bookings/loading.tsx), from its sidebar link;
 *   /bd/dashboard      the bespoke BD header, which its loading.tsx draws for
 *                      real, from its sidebar link;
 *   a package record   the bespoke record header (packages/[packageId]/
 *                      loading.tsx), from a card on /packages;
 *   a function sheet   the bespoke BEO header (beo/[id]/loading.tsx), from a
 *                      row on /beo. The seed has no function sheets, so this
 *                      one is skipped on a fresh database.
 *
 * `sidebarGroup` is the sidebar group whose link to open; `fromPage` instead
 * names a page whose own link (the first that `link` matches) is clicked.
 */
type LoadingCase = {
  name: string;
  /** The settled h1's accessible name, when it is fixed. */
  heading?: string;
} & (
  | { sidebarGroup: string; href: string }
  | { fromPage: string; link: string; emptyReason: string }
);

const LOADING_CASES: readonly LoadingCase[] = [
  { name: "/bookings", heading: "Bookings", sidebarGroup: "Bookings", href: "/bookings" },
  { name: "/bd/dashboard", heading: "BD Dashboard", sidebarGroup: "BD CRM", href: "/bd/dashboard" },
  {
    name: "a package record",
    fromPage: "/packages",
    link: 'a[href^="/packages/"]:not([href$="/edit"]):not([href="/packages/new"])',
    emptyReason: "No package on /packages to open.",
  },
  {
    name: "a function sheet",
    fromPage: "/beo",
    link: 'a[href^="/beo/"]',
    emptyReason: "No function sheet on /beo to open (the seed creates none).",
  },
];

for (const { label, width, height } of LOADING_VIEWPORTS) {
  test.describe(`header geometry · loading skeleton · ${label}`, () => {
    test.use({ viewport: { width, height } });

    /** How long the navigation's RSC response is held back, so the skeleton stays up to be measured. */
    const DELAY_MS = 1_500;

    for (const target of LOADING_CASES) {
      test(`on ${target.name} the skeleton's title box sits where the settled h1 lands`, async ({ page }) => {
        test.slow();

        // Next prefetches a route's loading state (everything down to its
        // loading.tsx) when a link to it is on screen or hovered, in a
        // production build only. Watch every such prefetch from the start,
        // per path, because a link that is on screen as soon as the page
        // loads (a package card) is prefetched before the test has found it,
        // and a hover does not ask again for a route already cached. The click
        // happens once the target's skeleton is on the client.
        const isRsc = (url: URL) => url.searchParams.has("_rsc");
        const isPrefetch = (req: Request) => req.headers()["next-router-prefetch"] !== undefined;
        const prefetchPath = (req: Request): string | null => {
          const url = new URL(req.url());
          return isRsc(url) && isPrefetch(req) ? url.pathname : null;
        };
        const pending = new Map<Request, string>();
        const prefetched = new Map<string, number>();
        const lastActivity = new Map<string, number>();
        page.on("request", (req) => {
          const path = prefetchPath(req);
          if (!path) return;
          pending.set(req, path);
          lastActivity.set(path, Date.now());
        });
        page.on("requestfinished", (req) => {
          const path = pending.get(req);
          if (!path) return;
          pending.delete(req);
          prefetched.set(path, (prefetched.get(path) ?? 0) + 1);
          lastActivity.set(path, Date.now());
        });
        page.on("requestfailed", (req) => {
          const path = pending.get(req);
          if (!path) return;
          pending.delete(req);
          lastActivity.set(path, Date.now());
        });

        // Open the page the click starts from, and find the link.
        const start = "fromPage" in target ? target.fromPage : "/dashboard";
        await page.goto(start, { waitUntil: "domcontentloaded" });
        await expect(page.locator("#main-content h1").first()).toBeVisible({ timeout: 30_000 });
        await dismissTwoFactorBanner(page);

        let link: Locator;
        if ("sidebarGroup" in target) {
          // On a phone the sidebar lives in a sheet; open it from the header's
          // sidebar toggle. Clicking one of its links closes it again.
          if (width < SIDEBAR_SHEET_BELOW) {
            await page.getByRole("button", { name: "Toggle Sidebar" }).filter({ visible: true }).first().click();
            await expect(page.locator('[data-sidebar="sidebar"][data-mobile="true"]')).toBeVisible();
          }
          // Off its own pages a sidebar group is collapsed; open it to reach
          // the link.
          const sidebar = page.locator('[data-sidebar="sidebar"]').filter({ visible: true }).first();
          link = sidebar.locator(`a[href="${target.href}"]`).first();
          if (!(await link.isVisible().catch(() => false))) {
            await sidebar.getByRole("button", { name: target.sidebarGroup, exact: true }).click();
          }
        } else {
          link = page.locator("#main-content").locator(target.link).filter({ visible: true }).first();
          const found = await link.waitFor({ state: "visible", timeout: 10_000 }).then(
            () => true,
            () => false
          );
          test.skip(!found, target.emptyReason);
        }
        await expect(link).toBeVisible();
        const href = await link.getAttribute("href");
        expect(href, `${target.name}: the link has no href`).toBeTruthy();
        const targetPath = new URL(href!, page.url()).pathname;
        const targetPending = () => [...pending.values()].some((path) => path === targetPath);

        // Hovering a link is a navigation intent: Next prefetches it straight
        // away if it has not already.
        await link.hover();

        const ready = await expect
          .poll(
            () =>
              (prefetched.get(targetPath) ?? 0) > 0 &&
              !targetPending() &&
              Date.now() - (lastActivity.get(targetPath) ?? 0) > 500,
            {
              timeout: 20_000,
              intervals: [100, 250, 500],
            }
          )
          .toBe(true)
          .then(
            () => true,
            () => false
          );
        // `next dev` never prefetches, so there is no skeleton to catch there. In
        // CI (a production build) a missing prefetch is a real failure.
        test.skip(!ready && !process.env.CI, `The server did not prefetch ${targetPath}; run against a production build (next start).`);
        expect(ready, `Next never finished prefetching ${targetPath}`).toBe(true);

        // Hold back the navigation's own RSC request (never a prefetch), so the
        // prefetched skeleton stays on screen while it is measured.
        let held = 0;
        await page.route(isRsc, async (route) => {
          if (!isPrefetch(route.request())) {
            held += 1;
            await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
          }
          await route.continue();
        });

        await link.click();

        const skeleton = page.locator('[data-slot="page-header-skeleton"]').filter({ visible: true }).first();
        await expect(skeleton, `the ${target.name} loading skeleton never appeared`).toBeVisible({ timeout: DELAY_MS });
        const skeletonTitle = await page.evaluate(measureSkeletonTitle);
        expect(skeletonTitle, "no title box in the skeleton's title row").not.toBeNull();

        await page.waitForURL((url) => url.pathname === targetPath);
        await expect(page.locator('[data-slot="page-header-skeleton"]').filter({ visible: true })).toHaveCount(0, {
          timeout: 30_000,
        });
        const h1 = target.heading
          ? page.locator("#main-content").getByRole("heading", { level: 1, name: target.heading })
          : page.locator("#main-content h1").filter({ visible: true }).first();
        await expect(h1).toBeVisible({ timeout: 30_000 });
        await settleLayout(page);
        const settled = await h1.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top };
        });

        expect(held, "the navigation's RSC request was never held back").toBeGreaterThan(0);
        // R15: the title does not move when the page replaces the skeleton. On a
        // phone the bookings eyebrow wraps to two lines, which the skeleton
        // reserves (bookings/loading.tsx), so the top holds there too.
        expect(
          Math.abs(skeletonTitle!.left - settled.left),
          `${label}px ${target.name}: skeleton title x ${px(skeletonTitle!.left)}, settled h1 x ${px(settled.left)}`
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(skeletonTitle!.top - settled.top),
          `${label}px ${target.name}: skeleton title y ${px(skeletonTitle!.top)}, settled h1 y ${px(settled.top)}`
        ).toBeLessThanOrEqual(2);
      });
    }
  });
}
