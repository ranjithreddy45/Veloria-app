import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ============================================================
// Route loading boundaries: the set of loading.tsx files is pinned.
// ------------------------------------------------------------
// On Next 16.1.6, a route's loading.tsx makes every <Link> into that route
// prefetch the segment in a second request. A click that lands while that
// request is in flight commits the new URL with an empty page segment that
// never fills: no h1, no error, nothing in the server log
// (vercel/next.js#98684, open). Thirteen boundaries added only to line
// skeletons up with their headers triggered it in the e2e suite, so they were
// removed. The files below are the ones that were already on main. Changing
// what one of them draws does not change prefetching, so they stay.
//
// A new loading file anywhere under src/app fails the first test until it is
// added to ALLOWED. Before adding it, check whether the installed Next fixes
// #98684. The second test fails once Next is no longer 16.1.6, so that check
// happens on the upgrade.
// ============================================================

const APP_DIR = fileURLToPath(new URL("./", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const RACE = "vercel/next.js#98684";
/** The Next version the race was confirmed on, and this allowlist checked against. */
const CHECKED_NEXT_VERSION = "16.1.6";

/** Every route loading boundary allowed under src/app, relative to src/app. */
const ALLOWED = [
  "(auth)/loading.tsx",
  "(dashboard)/bd/deals/loading.tsx",
  "(dashboard)/bd/leads/loading.tsx",
  "(dashboard)/bd/properties/loading.tsx",
  "(dashboard)/bookings/loading.tsx",
  "(dashboard)/contacts/loading.tsx",
  "(dashboard)/contracts/loading.tsx",
  "(dashboard)/dashboard/loading.tsx",
  "(dashboard)/invoices/loading.tsx",
  "(dashboard)/leads/loading.tsx",
  "(dashboard)/leads/war-room/loading.tsx",
  "(dashboard)/loading.tsx",
  "(dashboard)/payments/loading.tsx",
  "(dashboard)/pipeline/loading.tsx",
  "(dashboard)/quality/loading.tsx",
  "(dashboard)/whatsapp/loading.tsx",
  "(portal)/loading.tsx",
  "(portal)/portal/loading.tsx",
  "(vendor-portal)/vendor-portal/loading.tsx",
];

/** Next accepts a loading boundary in any page extension, not only .tsx. */
const LOADING_FILE = /^loading\.(tsx|ts|jsx|js)$/;

function loadingFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...loadingFiles(full));
    else if (LOADING_FILE.test(entry.name)) out.push(path.relative(APP_DIR, full).split(path.sep).join("/"));
  }
  return out;
}

describe("route loading boundaries", () => {
  it("are exactly the allowlisted loading.tsx files", () => {
    const found = loadingFiles(APP_DIR);
    const added = found.filter((f) => !ALLOWED.includes(f)).sort();
    const gone = ALLOWED.filter((f) => !found.includes(f));

    expect(
      added,
      `New loading file(s) under src/app: ${added.join(", ")}. Adding a route loading.tsx exposes ` +
        `Next.js router race ${RACE} (Link clicked mid-prefetch commits an empty page) on Next ` +
        `${CHECKED_NEXT_VERSION}; check whether the installed Next version fixes it before adding to ` +
        `the allowlist (ALLOWED in src/app/route-loading-boundaries.test.ts).`
    ).toEqual([]);
    expect(
      gone,
      `Allowlisted loading file(s) no longer exist: ${gone.join(", ")}. Remove them from ALLOWED in ` +
        `src/app/route-loading-boundaries.test.ts.`
    ).toEqual([]);
  });

  it(`run on Next ${CHECKED_NEXT_VERSION}, the version ${RACE} was checked on`, () => {
    const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "node_modules/next/package.json"), "utf8")) as {
      version: string;
    };

    expect(
      pkg.version,
      `Next is now ${pkg.version}, but the loading.tsx allowlist was checked against ` +
        `${CHECKED_NEXT_VERSION}. Re-check ${RACE} (Link clicked mid-prefetch commits an empty page) ` +
        `on this version. If it is fixed, route loading.tsx files are safe to add again; either way, ` +
        `update CHECKED_NEXT_VERSION (and ALLOWED, or this guard) in ` +
        `src/app/route-loading-boundaries.test.ts.`
    ).toBe(CHECKED_NEXT_VERSION);
  });
});
