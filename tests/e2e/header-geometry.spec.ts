import { test, expect, type Page } from "@playwright/test";
import { TOUR_SCREENS, measurePageHeader, settleLayout, type PageHeaderGeometry } from "./helpers";

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
//   loading - PageHeaderSkeleton's title box sits where PageHeader's h1
//             lands, at 1440px and at 390px, measured on the header/skeleton
//             pairs that /style-guide renders (no navigation timing; see the
//             "Loading skeleton" section below).
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

// ------------------------------------------------------------
// Loading skeleton (R15)
// ------------------------------------------------------------
//
// R15: when a page replaces its loading skeleton, the title does not move.
// PageHeaderSkeleton's title box must start where PageHeader's h1 lands, left
// and top within 2px, at 1440px and at 390px.
//
// A skeleton is only on screen while a navigation waits for the server, and
// catching one mid-navigation depends on when Next prefetches the route's
// loading state, which CI does not hold still: the client-navigation version
// of this check waited for a /bookings prefetch that never came and measured
// nothing. So the property is checked where it is deterministic. /style-guide
// renders each PageHeader variant above the PageHeaderSkeleton a route's
// loading.tsx draws for it, in two identical boxes (HEADER_PAIRS in
// src/app/style-guide/page.tsx). Both are the real components, laid out by the
// same classes and the same viewport breakpoints as on a route, and each
// position is taken relative to its own box. No prefetch, no network timing,
// no seeded rows; /style-guide is public, so this runs signed out.
//
// What it does not cover: which props each route's loading.tsx passes
// (bookings, leads, contacts and pipeline reserve a two-line phone eyebrow),
// and the bespoke record skeletons (bd/dashboard, beo/[id], kitchen/[id],
// packages/[packageId] and the like), which are drawn from their own headers.

const SKELETON_VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "390", width: 390, height: 844 },
] as const;

/** Tailwind's sm breakpoint: below it the chip is hidden and a count eyebrow may wrap. */
const SM = 640;
/** R15's tolerance between the skeleton's title box and the settled h1. */
const TITLE_MATCH = 2;
/** The eyebrow's height: one 11px line at line-height 1.45, or two plus the eyebrow row's 4px gap. */
const EYEBROW_HEIGHT = { 1: 16, 2: 36 } as const;

/**
 * The pairs /style-guide must render, by `data-header-pair`, and the state
 * each one exists to show, so a pair that stops showing it fails here rather
 * than passing without testing anything:
 *
 *   eyebrow           the page's own eyebrow, no action cluster;
 *   module-eyebrow    no eyebrow passed, so PageHeader's default (ModuleEyebrow);
 *   actions-meta      an action cluster and a meta row (rootWithActions, and
 *                     PageHeaderSkeleton actions={1} meta);
 *   two-line-eyebrow  an eyebrow of counts that is two lines below sm and one
 *                     from sm up (eyebrowLines={2}), with an action cluster.
 */
const SKELETON_PAIRS: readonly { id: string; actions: boolean; phoneEyebrowLines: 1 | 2 }[] = [
  { id: "eyebrow", actions: false, phoneEyebrowLines: 1 },
  { id: "module-eyebrow", actions: false, phoneEyebrowLines: 1 },
  { id: "actions-meta", actions: true, phoneEyebrowLines: 1 },
  { id: "two-line-eyebrow", actions: true, phoneEyebrowLines: 2 },
];

type HeaderPairGeometry = {
  id: string;
  /** Widths of the pair's two boxes: the comparison only means something when they match. */
  headerBoxWidth: number;
  skeletonBoxWidth: number;
  /** The h1, and the skeleton's title box, each relative to its own box. Null when missing. */
  h1: { left: number; top: number } | null;
  title: { left: number; top: number } | null;
  /** Height of the header's eyebrow and of the skeleton's eyebrow placeholder (null when absent). */
  headerEyebrow: number | null;
  skeletonEyebrow: number | null;
  /** Whether the module chip and the skeleton's chip placeholder are on screen. */
  headerChip: boolean;
  skeletonChip: boolean;
  /** Pills on screen in the header's cluster, and pill placeholders in the skeleton's action slot. */
  headerPills: number;
  skeletonPills: number;
  /** Each root's computed align-items: from sm up, flex-end without actions and center with them. */
  headerAlign: string | null;
  skeletonAlign: string | null;
};

/**
 * Measure every header/skeleton pair on /style-guide. Runs IN THE PAGE:
 * `page.evaluate(measureHeaderPairs)`. Self-contained, because Playwright
 * serialises it; it may not call anything defined outside its own body.
 *
 * Both components nest root > title column > title row; the h1 (and the
 * skeleton's title box, marked data-skeleton-part="title") sits in the title
 * row after the chip, and the eyebrow is the row's previous sibling.
 */
function measureHeaderPairs(): HeaderPairGeometry[] {
  const rendered = (el: Element | null | undefined): boolean => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };
  const within = (el: Element | null | undefined, box: Element | null | undefined) => {
    if (!el || !box) return null;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return { left: r.left - b.left, top: r.top - b.top };
  };
  const heightOf = (el: Element | null | undefined) => (el && rendered(el) ? el.getBoundingClientRect().height : null);
  const widthOf = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().width : 0);
  const alignOf = (el: Element | null | undefined) => (el ? getComputedStyle(el).alignItems : null);

  return Array.from(document.querySelectorAll("[data-header-pair]")).map((pair) => {
    const headerBox = pair.querySelector(':scope > [data-pair-part="header"]');
    const skeletonBox = pair.querySelector(':scope > [data-pair-part="skeleton"]');

    const h1 = headerBox?.querySelector("h1") ?? null;
    const headerRow = h1?.parentElement ?? null;
    const headerRoot = headerRow?.parentElement?.parentElement ?? null;

    const skeletonRoot = skeletonBox?.querySelector('[data-slot="page-header-skeleton"]') ?? null;
    const title = skeletonRoot?.querySelector('[data-skeleton-part="title"]') ?? null;
    const skeletonRow = title?.parentElement ?? null;
    const skeletonColumn = skeletonRow?.parentElement ?? null;
    // The pill placeholders are the slot after the title column, when there is one.
    const slot = skeletonColumn?.parentElement === skeletonRoot ? (skeletonColumn?.nextElementSibling ?? null) : null;

    return {
      id: pair.getAttribute("data-header-pair") ?? "",
      headerBoxWidth: widthOf(headerBox),
      skeletonBoxWidth: widthOf(skeletonBox),
      h1: within(h1, headerBox),
      title: within(title, skeletonBox),
      headerEyebrow: heightOf(headerRow?.previousElementSibling),
      skeletonEyebrow: heightOf(skeletonRow?.previousElementSibling),
      headerChip: rendered(headerRow?.querySelector(':scope > [data-slot="module-chip"]')),
      skeletonChip: rendered(title?.previousElementSibling),
      headerPills: Array.from(headerBox?.querySelectorAll('[data-slot="quick-action"]') ?? []).filter((el) => rendered(el)).length,
      skeletonPills: slot ? Array.from(slot.children).filter((el) => rendered(el)).length : 0,
      headerAlign: alignOf(headerRoot),
      skeletonAlign: alignOf(skeletonRoot),
    };
  });
}

for (const { label, width, height } of SKELETON_VIEWPORTS) {
  test.describe(`header geometry · loading skeleton · ${label}`, () => {
    // Signed out: /style-guide is public, and this way the check needs nothing
    // from the shared admin session.
    test.use({ viewport: { width, height }, storageState: { cookies: [], origins: [] } });

    test("PageHeaderSkeleton's title box sits where PageHeader's h1 lands", async ({ page }) => {
      const response = await page.goto("/style-guide", { waitUntil: "domcontentloaded" });
      const status = response?.status() ?? 0;
      expect(status, `/style-guide responded ${status}`).toBeLessThan(400);
      expect(new URL(page.url()).pathname, "/style-guide redirected (it must stay public)").toBe("/style-guide");

      // The page is server-rendered whole, so once one pair is up they all are;
      // which pairs are there is checked by id below, with a clearer message.
      await expect(page.locator("[data-header-pair]").first()).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("load");
      // Fonts loaded: the eyebrow's width decides whether it wraps.
      await settleLayout(page);

      const measured = await page.evaluate(measureHeaderPairs);
      await test.info().attach(`header-geometry-skeleton-${label}.json`, {
        body: JSON.stringify(measured, null, 2),
        contentType: "application/json",
      });
      expect(
        measured.map((m) => m.id).sort(),
        "the header/skeleton pairs on /style-guide (HEADER_PAIRS there, SKELETON_PAIRS here)"
      ).toEqual(SKELETON_PAIRS.map((p) => p.id).sort());

      const phone = width < SM;
      for (const pair of SKELETON_PAIRS) {
        const m = measured.find((x) => x.id === pair.id);
        if (!m) continue;
        const at = `${pair.id} at ${label}px`;

        // The two boxes are the same width, so the two layouts are comparable.
        expect.soft(Math.abs(m.headerBoxWidth - m.skeletonBoxWidth), `${at}: header box ${px(m.headerBoxWidth)} wide, skeleton box ${px(m.skeletonBoxWidth)}`).toBeLessThanOrEqual(SAME_X);
        expect.soft(m.h1, `${at}: no h1 in the PageHeader`).not.toBeNull();
        expect.soft(m.title, `${at}: no data-skeleton-part="title" box in the PageHeaderSkeleton`).not.toBeNull();

        // The pair shows the state it is there for. Chip: on screen from sm up,
        // hidden below, in both.
        expect.soft(m.headerChip, `${at}: the module chip should be ${phone ? "hidden" : "on screen"}`).toBe(!phone);
        expect.soft(m.skeletonChip, `${at}: the skeleton's chip placeholder should be ${phone ? "hidden" : "on screen"}`).toBe(!phone);
        // Eyebrow: one line, or two below sm for the count eyebrow.
        const lines = phone ? pair.phoneEyebrowLines : 1;
        expect.soft(m.headerEyebrow, `${at}: no eyebrow above the PageHeader's title row`).not.toBeNull();
        if (m.headerEyebrow !== null) {
          expect.soft(
            Math.abs(m.headerEyebrow - EYEBROW_HEIGHT[lines]),
            `${at}: the PageHeader eyebrow is ${px(m.headerEyebrow)} tall; ${lines} line${lines === 1 ? "" : "s"} is ${EYEBROW_HEIGHT[lines]}px`
          ).toBeLessThanOrEqual(TITLE_MATCH);
        }
        // Actions: a cluster with a pill in the header exactly when the
        // skeleton reserves one, and the two roots aligned the same way.
        expect.soft(m.headerPills > 0, `${at}: ${m.headerPills} pill(s) in the PageHeader's cluster`).toBe(pair.actions);
        expect.soft(m.skeletonPills > 0, `${at}: ${m.skeletonPills} pill placeholder(s) in the skeleton`).toBe(pair.actions);
        expect.soft(m.skeletonAlign, `${at}: the skeleton root's align-items`).toBe(m.headerAlign);

        // R15: the title box starts where the h1 does.
        if (!m.h1 || !m.title) continue;
        expect.soft(
          Math.abs(m.title.left - m.h1.left),
          `${at}: skeleton title x ${px(m.title.left)}, h1 x ${px(m.h1.left)} (from each box's left edge)`
        ).toBeLessThanOrEqual(TITLE_MATCH);
        expect.soft(
          Math.abs(m.title.top - m.h1.top),
          `${at}: skeleton title y ${px(m.title.top)}, h1 y ${px(m.h1.top)} (from each box's top; eyebrow ${m.skeletonEyebrow === null ? "none" : px(m.skeletonEyebrow)} in the skeleton, ${m.headerEyebrow === null ? "none" : px(m.headerEyebrow)} in the header)`
        ).toBeLessThanOrEqual(TITLE_MATCH);
      }
    });
  });
}
