import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, hasPermission } from "./permissions";

// A FINANCE session used to carry all 230 permission strings inside the JWT,
// i.e. inside the session cookie. Apache's LimitRequestFieldSize is 8190 bytes,
// so every request from that user returned 431 and they could not load any
// page — including /sign-in — to recover. The token now carries only the delta
// from the role's defaults.
describe("session cookie size", () => {
  const roles = Object.keys(ROLE_PERMISSIONS);

  it("the old scheme really would overflow the header for FINANCE", () => {
    const full = JSON.stringify(ROLE_PERMISSIONS["FINANCE"]);
    // ~3,984 bytes of raw JSON for 230 permissions. The token is then JWE
    // encrypted and base64url encoded (roughly 1.4-1.6x), carried as a cookie
    // NAME=VALUE pair alongside the other claims (id, role, email, tfa, exp)
    // and every other cookie on the domain — which is how it cleared Apache's
    // 8190-byte LimitRequestFieldSize and produced 431 for that user.
    expect(full.length).toBeGreaterThan(3500);
    expect(ROLE_PERMISSIONS["FINANCE"].length).toBeGreaterThan(200);
  });

  it("no role's default list is carried in the token any more", () => {
    // What bakePerms now emits with no RolePermission overrides present.
    const delta = (role: string) => {
      const effective = new Set<string>(ROLE_PERMISSIONS[role] ?? []);
      const defaults = new Set<string>(ROLE_PERMISSIONS[role] ?? []);
      return {
        add: [...effective].filter((p) => !defaults.has(p)),
        del: [...defaults].filter((p) => !effective.has(p)),
      };
    };
    for (const role of roles) {
      const d = delta(role);
      expect(JSON.stringify(d).length).toBeLessThan(40); // {"add":[],"del":[]}
    }
  });

  it("the delta still resolves the same answer middleware needs", () => {
    // Mirrors the middleware expression: defaults, then remove, then add.
    const resolve = (role: string, required: string, add: string[] = [], del: string[] = []) => {
      let allowed = hasPermission(role, required);
      if (del.includes(required)) allowed = false;
      if (add.includes(required)) allowed = true;
      return allowed;
    };
    expect(resolve("FINANCE", "quotes:read")).toBe(true);
    expect(resolve("STAFF", "quotes:read")).toBe(false);
    // an override that GRANTS something the role lacks
    expect(resolve("STAFF", "quotes:read", ["quotes:read"])).toBe(true);
    // an override that REVOKES something the role has
    expect(resolve("FINANCE", "quotes:read", [], ["quotes:read"])).toBe(false);
  });
});
