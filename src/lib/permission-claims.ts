// ============================================================
// Override-aware permission checks for page actions
// ============================================================
//
// Mirrored source: middleware.ts:161-182 (the per-route permission block
// inside `if (role !== "SUPER_ADMIN" && role !== "ADMIN")`).
//
// `claimsAllow` repeats that block line for line, so a server page can decide
// whether to show a pill (a header action, a dashboard shortcut) with exactly
// the rule middleware will apply when the pill is clicked. A pill shown to
// someone middleware then bounces to /not-authorized is a dead end; one hidden
// from someone an admin has granted access to is a missing feature. Both
// happen if a page checks the static role matrix (`hasPermission`) instead.
//
// middleware.ts is deliberately NOT changed to import this yet (the owner's
// main checkout has uncommitted edits to it). Until that follow-up lands, the
// two copies are pinned together by permission-claims.test.ts, which fails if
// the middleware block drifts from the text this file mirrors.
//
// Pure functions, no I/O, edge- and client-safe: the only import is the static
// matrix that middleware itself uses.

import { hasPermission, routePermission, type Permission } from "@/lib/permissions";

/**
 * The permission claims middleware reads off the session user
 * (`req.auth.user`).
 *
 * - `perms` is the LEGACY full effective list. When present it wins outright,
 *   so sessions issued before the 431 fix keep working until they expire.
 * - `permsAdd` / `permsDel` are the override delta from the role's static
 *   defaults (RolePermission rows), baked by `bakePerms` in auth.ts.
 */
export type PermissionClaims = {
  perms?: string[] | null;
  permsAdd?: string[] | null;
  permsDel?: string[] | null;
};

/**
 * Anything shaped like a next-auth session: `await auth()` passes straight in.
 * Only `user.role` and the permission claims are read.
 */
export type ClaimsSession =
  | {
      user?: (PermissionClaims & { role?: string | null }) | null;
    }
  | null
  | undefined;

/**
 * Does a user with this role and these session claims hold `required`?
 *
 * Mirrors middleware.ts:161-182 line for line:
 * - SUPER_ADMIN / ADMIN bypass every route permission → true.
 * - A legacy `perms` array wins: allowed iff it lists `required`.
 * - Otherwise the role's static default (`hasPermission`), then `permsDel`
 *   removes and `permsAdd` adds — in that order, so a permission listed in both
 *   is allowed, exactly as middleware decides it.
 *
 * A missing role is never allowed: middleware turns a role-less session away
 * (middleware.ts:153) before it ever reaches the per-route block.
 */
export function claimsAllow(
  role: string | null | undefined,
  claims: PermissionClaims | null | undefined,
  required: Permission,
): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;

  let allowed: boolean;
  const legacy = claims?.perms;
  if (Array.isArray(legacy)) {
    allowed = legacy.includes(required);
  } else {
    allowed = hasPermission(role, required);
    if (claims?.permsDel?.includes(required)) allowed = false;
    if (claims?.permsAdd?.includes(required)) allowed = true;
  }
  return allowed;
}

/** `claimsAllow` for a whole session, e.g. `sessionAllows(await auth(), "hr:write")`. */
export function sessionAllows(session: ClaimsSession, required: Permission): boolean {
  const user = session?.user;
  return claimsAllow(user?.role, user, required);
}

/**
 * What an action needs to be shown. Extra fields (label, hint, primary, …)
 * ride along untouched.
 *
 * - `permission` omitted → the destination's route permission,
 *   `routePermission(href)`: the same lookup middleware uses.
 * - `permission: "x:y"` → a STRICTER check the destination page itself makes
 *   (e.g. leads:create for /leads/import, hr:write for /people/import). It is
 *   required IN ADDITION to the route permission, never instead of it, so an
 *   explicit permission can never reveal a pill middleware would bounce.
 * - `permission: null` → no permission check at all (an explicit opt-out).
 * - `when: false` → hidden regardless (feature flags, module setup state).
 */
export type ActionGate = {
  href: string;
  permission?: Permission | null;
  when?: boolean;
};

/**
 * The pathname middleware would see for a pill's href, or null when the href
 * is not a root-relative app path (external URL, protocol-relative URL,
 * mailto:/tel:, bare #hash or a relative path) and so has no route permission.
 */
function hrefPathname(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const end = href.search(/[?#]/);
  return end === -1 ? href : href.slice(0, end);
}

/**
 * Filters page actions down to the ones this session may actually open.
 *
 * Keeps an action only when `when !== false` AND every permission it needs is
 * held under the same override-aware rule as middleware (see `ActionGate` for
 * what "needs" means). Order is preserved and the original objects are
 * returned unmodified — the result is the caller's own plain data, so an array
 * of plain specs stays serialisable to client components.
 *
 * Note for admins: SUPER_ADMIN / ADMIN pass every check here, as they do in
 * middleware. A destination that checks the static matrix itself (for example
 * `hasPermission(role, "beo:write")`, which ADMIN does not hold) can still
 * refuse ADMIN; gate such a pill with `when` as well.
 */
export function visibleActions<T extends ActionGate>(
  session: ClaimsSession,
  actions: readonly T[],
): T[] {
  const user = session?.user;
  const role = user?.role;
  return actions.filter((action) => {
    if (action.when === false) return false;
    if (action.permission === null) return true;

    const path = hrefPathname(action.href);
    const route = path === null ? null : routePermission(path);
    if (route && !claimsAllow(role, user, route)) return false;

    const explicit = action.permission;
    if (explicit && explicit !== route && !claimsAllow(role, user, explicit)) {
      return false;
    }
    return true;
  });
}
