// ============================================================
// Personal workspace — sidebar pins (pure logic)
// ============================================================
//
// A pin is just the `href` of a nav destination. Everything here is a pure
// function over plain data so it can be unit-tested without a DOM (the repo has
// no jsdom) and reused unchanged when the store moves from localStorage to a
// per-user DB column.
//
// THE SECURITY-SHAPED RULE: a stored pin is never trusted as a link. Pins are
// only ever rendered by looking them up in the navigation that has ALREADY been
// role-filtered for this user (`resolvePins`). A pin whose module the role can
// no longer see simply fails the lookup and drops out of the rendered list — we
// never build a link from the stored string itself.

/** Eight fits the pinned group above the fold on a laptop without pushing the
 *  real navigation off-screen; beyond that "pinned" stops meaning "shortcut". */
export const MAX_PINS = 8;

/** Structural subset of NavItem — kept local so this module has no import from
 *  the 1,000-line nav config and tests can use tiny fixtures. */
export interface PinnableNavItem {
  title: string;
  href: string;
  icon: string;
  children?: PinnableNavItem[];
}

export type TogglePinResult =
  | { ok: true; pins: string[]; pinned: boolean }
  | { ok: false; pins: string[]; reason: "limit" };

/**
 * Flattens (already role-filtered) navigation into the destinations that can be
 * pinned: leaf items and the children of groups. Group headers themselves are
 * not pinnable — they are disclosure buttons, not links, and in this nav a
 * group's href duplicates its first child's, so pinning both would produce two
 * identical shortcuts. First occurrence of an href wins for the same reason.
 */
export function flattenPinnable<T extends PinnableNavItem>(items: T[]): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  const walk = (list: T[]) => {
    for (const item of list) {
      if (item.children && item.children.length > 0) {
        walk(item.children as T[]);
      } else if (!seen.has(item.href)) {
        seen.add(item.href);
        out.push(item);
      }
    }
  };
  walk(items);
  return out;
}

/**
 * Stored pins come from localStorage (user-editable, possibly written by an
 * older build), so anything that is not a clean list of internal paths is
 * discarded rather than thrown on — a corrupt value must never take the whole
 * sidebar down. Also re-applies the cap so a hand-edited value cannot exceed it.
 */
export function sanitizePins(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    // Internal paths only: "/x", never "//host" or "https://…".
    if (typeof v !== "string" || !v.startsWith("/") || v.startsWith("//")) continue;
    if (out.includes(v)) continue;
    out.push(v);
    if (out.length >= MAX_PINS) break;
  }
  return out;
}

/** Parses the raw localStorage string. Any failure = "nothing pinned". */
export function parseStoredPins(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    return sanitizePins(JSON.parse(json));
  } catch {
    return [];
  }
}

/**
 * Add or remove one pin. Removing is always allowed (so a user at the cap can
 * always get back under it); adding past the cap reports `limit` so the UI can
 * explain instead of silently doing nothing.
 *
 * `allowedHrefs` is the set of destinations the user can actually SEE right
 * now. The cap is enforced against the visible pins, not the stored length: if
 * a role change hid three pins, the user sees five and must be able to add
 * more — being told "you already have 8" while looking at 5 would be
 * inexplicable. Only when the stored list is genuinely full are the hidden
 * pins evicted to make room; otherwise they are kept (see `resolvePins`).
 */
export function togglePin(
  pins: string[],
  href: string,
  allowedHrefs?: ReadonlySet<string>
): TogglePinResult {
  if (pins.includes(href)) {
    return { ok: true, pins: pins.filter((p) => p !== href), pinned: false };
  }
  const visible = allowedHrefs ? pins.filter((p) => allowedHrefs.has(p)) : pins;
  if (visible.length >= MAX_PINS) {
    return { ok: false, pins, reason: "limit" };
  }
  // Under the visible cap but the stored list is full of pins the role can no
  // longer see: drop those hidden ones to make room rather than refuse.
  const base = pins.length >= MAX_PINS ? visible : pins;
  return { ok: true, pins: [...base, href], pinned: true };
}

/**
 * Turns stored hrefs into renderable nav items, in the user's pin order, by
 * looking each one up in the ROLE-FILTERED pinnable list. Unknown hrefs (module
 * removed, renamed, or no longer permitted) are skipped silently. The stored
 * list is deliberately NOT rewritten when that happens: a temporary permission
 * change should not destroy someone's setup — the pin reappears if access does.
 */
export function resolvePins<T extends PinnableNavItem>(
  pins: string[],
  allowed: T[]
): T[] {
  const byHref = new Map(allowed.map((item) => [item.href, item] as const));
  const out: T[] = [];
  for (const href of pins) {
    const item = byHref.get(href);
    if (item) out.push(item);
  }
  return out;
}

/** Per-user key: a shared front-desk machine must not show one person's pins
 *  to the next person who signs in. */
export function pinsStorageKey(userId: string): string {
  return `vg:workspace:pins:${userId}`;
}
