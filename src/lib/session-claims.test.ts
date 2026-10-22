import { describe, expect, it } from "vitest";
import authConfig from "../../auth.config";
import { sessionAllows } from "./permission-claims";
import { ROLE_PERMISSIONS, type Permission } from "./permissions";

// ============================================================
// The session callback must carry the permission claims baked into the JWT.
//
// Regression guard for a real outage: `bakePerms` (auth.ts) stopped writing the
// legacy full `perms` list and started writing the override DELTA
// (`permsAdd` / `permsDel`), but the session callback still copied only
// `perms`. Both middleware (`req.auth.user`) and every server action
// (`sessionAllows(await auth(), …)`) read the SESSION, so the delta never
// reached either one: `claimsAllow` fell back to the static role defaults and
// every RolePermission grant or revoke made in Settings → Roles was silently
// ignored for everyone except SUPER_ADMIN / ADMIN (who short-circuit).
//
// Symptom: an employee granted "venue-owners:manage" still got
// "You don't have permission to manage venue owners."
// ============================================================

type Claims = { perms?: string[]; permsAdd?: string[]; permsDel?: string[] };

/** Run the real session callback the way next-auth does. */
function buildSession(role: string, claims: Claims) {
  const session = { user: { id: "u1", name: "T", email: "t@x.com" } };
  const token = { id: "u1", role, ...claims };
  const cb = authConfig.callbacks?.session as (a: unknown) => { user: Claims & { role?: string } };
  return cb({ session, token });
}

// A role that does NOT hold the permission by default, so only the override
// can grant it — exactly the delegation case the bug broke.
const DELEGATE_ROLE = "EVENT_COORDINATOR";
const PERM: Permission = "venue-owners:manage";

describe("session callback carries permission claims", () => {
  it("copies permsAdd and permsDel onto session.user", () => {
    const s = buildSession(DELEGATE_ROLE, { permsAdd: [PERM], permsDel: ["leads:delete"] });
    expect(s.user.permsAdd).toEqual([PERM]);
    expect(s.user.permsDel).toEqual(["leads:delete"]);
  });

  it("still carries the legacy perms list when a token has one", () => {
    const s = buildSession(DELEGATE_ROLE, { perms: [PERM] });
    expect(s.user.perms).toEqual([PERM]);
  });
});

describe("granting a permission in Settings → Roles actually takes effect", () => {
  it("denies the delegate role by default", () => {
    expect(ROLE_PERMISSIONS[DELEGATE_ROLE]?.includes(PERM)).toBe(false);
    expect(sessionAllows(buildSession(DELEGATE_ROLE, {}), PERM)).toBe(false);
  });

  it("allows it once granted (permsAdd) — the bug this guards", () => {
    expect(sessionAllows(buildSession(DELEGATE_ROLE, { permsAdd: [PERM] }), PERM)).toBe(true);
  });

  it("revokes a default permission when permsDel removes it", () => {
    const granted = ROLE_PERMISSIONS[DELEGATE_ROLE]?.[0] as Permission;
    expect(sessionAllows(buildSession(DELEGATE_ROLE, {}), granted)).toBe(true);
    expect(sessionAllows(buildSession(DELEGATE_ROLE, { permsDel: [granted] }), granted)).toBe(false);
  });
});

describe("venue owners: admins hold it by default", () => {
  it("SUPER_ADMIN and ADMIN can manage venue owners with no overrides", () => {
    expect(ROLE_PERMISSIONS.SUPER_ADMIN?.includes(PERM)).toBe(true);
    expect(ROLE_PERMISSIONS.ADMIN?.includes(PERM)).toBe(true);
    expect(sessionAllows(buildSession("SUPER_ADMIN", {}), PERM)).toBe(true);
    expect(sessionAllows(buildSession("ADMIN", {}), PERM)).toBe(true);
  });

  it("an admin keeps it even if a stale token carries a delta without it", () => {
    expect(sessionAllows(buildSession("ADMIN", { permsDel: [PERM] }), PERM)).toBe(true);
  });
});
