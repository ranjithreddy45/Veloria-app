import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  claimsAllow,
  sessionAllows,
  visibleActions,
  type PermissionClaims,
} from "./permission-claims";
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  ROUTE_PERMISSIONS,
  hasPermission,
  routePermission,
  type Permission,
} from "./permissions";

// ------------------------------------------------------------
// Reference: middleware.ts:160-183, copied verbatim (comments dropped) and
// returning the decision instead of redirecting. The source pin below proves
// middleware still contains exactly this code, and the parity tests prove
// claimsAllow decides every case the same way.
// ------------------------------------------------------------
function middlewareAllows(
  role: string,
  user: PermissionClaims | undefined,
  pathname: string,
): boolean {
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    const required = routePermission(pathname);
    if (required) {
      const claims = user as
        | { perms?: string[]; permsAdd?: string[]; permsDel?: string[] }
        | undefined;
      let allowed: boolean;
      if (Array.isArray(claims?.perms)) {
        allowed = claims.perms.includes(required);
      } else {
        allowed = hasPermission(role, required);
        if (claims?.permsDel?.includes(required)) allowed = false;
        if (claims?.permsAdd?.includes(required)) allowed = true;
      }
      if (!allowed) {
        return false;
      }
    }
  }
  return true;
}

/** The middleware block as it reads today, minus comments and whitespace. */
const MIRRORED_BLOCK = `
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    const required = routePermission(pathname);
    if (required) {
      const claims = user as
        | { perms?: string[]; permsAdd?: string[]; permsDel?: string[] }
        | undefined;
      let allowed: boolean;
      if (Array.isArray(claims?.perms)) {
        allowed = claims.perms.includes(required);
      } else {
        allowed = hasPermission(role, required);
        if (claims?.permsDel?.includes(required)) allowed = false;
        if (claims?.permsAdd?.includes(required)) allowed = true;
      }
      if (!allowed) {
        return NextResponse.redirect(new URL("/not-authorized", nextUrl));
      }
    }
  }
`;

const normalise = (code: string) =>
  code
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("")
    .replace(/\s+/g, "");

const ROLES = Object.keys(ROLE_PERMISSIONS);

/** Claim shapes a session can carry, including the legacy full list. */
const CLAIM_FIXTURES: (PermissionClaims | undefined)[] = [
  undefined,
  {},
  { permsAdd: ["quotes:read", "hr:payroll"] },
  { permsDel: ["leads:read", "leads:create", "bookings:read"] },
  { permsAdd: ["invoices:read"], permsDel: ["invoices:read", "tasks:read"] },
  { perms: [] },
  { perms: ["x"] },
  { perms: ["quotes:read", "tasks:read"], permsDel: ["quotes:read"] },
];

describe("middleware parity pin", () => {
  it("middleware.ts still contains the block permission-claims.ts mirrors (or imports claimsAllow)", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../middleware.ts", import.meta.url)),
      "utf8",
    );
    const importsHelper =
      source.includes("@/lib/permission-claims") && source.includes("claimsAllow(");
    // If this fails, middleware's per-route rule changed: update claimsAllow
    // (and MIRRORED_BLOCK / middlewareAllows here) to match, or make
    // middleware import claimsAllow — the planned follow-up.
    expect(importsHelper || normalise(source).includes(normalise(MIRRORED_BLOCK))).toBe(true);
  });

  it("claimsAllow decides every role x permission x claim shape exactly as middleware", () => {
    // Every permission a route gates, exercised through its real prefix.
    // claimsAllow treats every permission identically, so these also cover
    // the explicit, route-free checks pages declare (leads:create, hr:write).
    const pathFor = new Map<Permission, string>();
    for (const r of ROUTE_PERMISSIONS) {
      if (routePermission(r.prefix) === r.permission && !pathFor.has(r.permission)) {
        pathFor.set(r.permission, r.prefix);
      }
    }
    let compared = 0;
    for (const role of [...ROLES, "UNKNOWN_ROLE"]) {
      for (const claims of CLAIM_FIXTURES) {
        for (const [permission, path] of pathFor) {
          expect(
            claimsAllow(role, claims, permission),
            `${role} ${JSON.stringify(claims)} ${permission} via ${path}`,
          ).toBe(middlewareAllows(role, claims, path));
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(1000);
  });

  it("visibleActions with no explicit permission shows a pill iff the middleware rule allows its destination", () => {
    const hrefs = ROUTE_PERMISSIONS.flatMap((r) => [r.prefix, `${r.prefix}/new?from=pill#top`]);
    hrefs.push("/dashboard", "/calendar", "/me/approvals");
    for (const role of ROLES) {
      for (const claims of CLAIM_FIXTURES) {
        const session = { user: { role, ...claims } };
        const shown = new Set(
          visibleActions(session, hrefs.map((href) => ({ href }))).map((a) => a.href),
        );
        for (const href of hrefs) {
          const pathname = href.split(/[?#]/)[0];
          expect(shown.has(href), `${role} ${JSON.stringify(claims)} ${href}`).toBe(
            middlewareAllows(role, claims, pathname),
          );
        }
      }
    }
  });
});

describe("claimsAllow", () => {
  it("SUPER_ADMIN with no claims → allow", () => {
    for (const p of ALL_PERMISSIONS) expect(claimsAllow("SUPER_ADMIN", undefined, p)).toBe(true);
  });

  it("ADMIN bypasses everything, even permissions its static list lacks and a delta that removes them", () => {
    expect(hasPermission("ADMIN", "beo:read")).toBe(false); // the matrix really lacks it
    expect(claimsAllow("ADMIN", undefined, "beo:read")).toBe(true);
    expect(claimsAllow("ADMIN", { permsDel: ["leads:read"] }, "leads:read")).toBe(true);
    expect(claimsAllow("ADMIN", { perms: [] }, "leads:read")).toBe(true);
  });

  it("STAFF with quotes:read → deny", () => {
    expect(hasPermission("STAFF", "quotes:read")).toBe(false);
    expect(claimsAllow("STAFF", undefined, "quotes:read")).toBe(false);
    expect(claimsAllow("STAFF", {}, "quotes:read")).toBe(false);
  });

  it("STAFF with permsAdd ['quotes:read'] → allow", () => {
    expect(claimsAllow("STAFF", { permsAdd: ["quotes:read"] }, "quotes:read")).toBe(true);
  });

  it("SALES_EXEC with permsDel ['leads:create'] → deny", () => {
    expect(claimsAllow("SALES_EXEC", undefined, "leads:create")).toBe(true);
    expect(claimsAllow("SALES_EXEC", { permsDel: ["leads:create"] }, "leads:create")).toBe(false);
    // Only the listed permission is removed.
    expect(claimsAllow("SALES_EXEC", { permsDel: ["leads:create"] }, "leads:read")).toBe(true);
  });

  it("permsAdd wins over permsDel when both list it (middleware applies del, then add)", () => {
    const claims = { permsAdd: ["tasks:read"], permsDel: ["tasks:read"] };
    expect(claimsAllow("STAFF", claims, "tasks:read")).toBe(true);
  });

  it("legacy perms ['x'] wins over the role matrix", () => {
    expect(hasPermission("SALES_EXEC", "leads:read")).toBe(true);
    expect(claimsAllow("SALES_EXEC", { perms: ["x"] }, "leads:read")).toBe(false);
    // …in both directions, and the delta is ignored while a legacy list exists.
    expect(claimsAllow("STAFF", { perms: ["quotes:read"] }, "quotes:read")).toBe(true);
    expect(
      claimsAllow("STAFF", { perms: ["quotes:read"], permsDel: ["quotes:read"] }, "quotes:read"),
    ).toBe(true);
    expect(claimsAllow("SALES_EXEC", { perms: [] }, "leads:read")).toBe(false);
  });

  it("null claims fall back to the role matrix", () => {
    expect(claimsAllow("SALES_EXEC", null, "leads:read")).toBe(true);
    expect(claimsAllow("SALES_EXEC", { perms: null, permsAdd: null, permsDel: null }, "leads:read")).toBe(true);
  });

  it("no role or an unknown role is never allowed, whatever the claims", () => {
    expect(claimsAllow(undefined, { permsAdd: ["leads:read"] }, "leads:read")).toBe(false);
    expect(claimsAllow(null, undefined, "leads:read")).toBe(false);
    expect(claimsAllow("", { perms: ["leads:read"] }, "leads:read")).toBe(false);
    expect(claimsAllow("NOT_A_ROLE", undefined, "leads:read")).toBe(false);
  });
});

describe("sessionAllows", () => {
  it("reads the role and claims off the session user", () => {
    expect(sessionAllows({ user: { role: "STAFF", permsAdd: ["quotes:read"] } }, "quotes:read")).toBe(true);
    expect(sessionAllows({ user: { role: "STAFF" } }, "quotes:read")).toBe(false);
    expect(sessionAllows(null, "quotes:read")).toBe(false);
    expect(sessionAllows({ user: null }, "quotes:read")).toBe(false);
    expect(sessionAllows({ user: { role: "SUPER_ADMIN" } }, "hr:payroll")).toBe(true);
  });
});

describe("visibleActions", () => {
  const staff = { user: { role: "STAFF" } };
  const superAdmin = { user: { role: "SUPER_ADMIN" } };

  it("`when: false` is dropped, even for SUPER_ADMIN", () => {
    const out = visibleActions(superAdmin, [
      { href: "/people/payroll", label: "Payroll", when: false },
      { href: "/people/leave", label: "Leave", when: true },
      { href: "/people/attendance", label: "Attendance" },
    ]);
    expect(out.map((a) => a.label)).toEqual(["Leave", "Attendance"]);
  });

  it("`permission: null` is kept, even where the route permission is missing", () => {
    expect(hasPermission("STAFF", "quotes:read")).toBe(false);
    const out = visibleActions(staff, [
      { href: "/quotations/new", label: "New quotation", permission: null },
    ]);
    expect(out).toHaveLength(1);
  });

  it("`permission: null` still respects `when: false`", () => {
    expect(visibleActions(superAdmin, [{ href: "/x", permission: null, when: false }])).toEqual([]);
  });

  it("defaults to the destination's route permission (the F01 /bookings dead ends)", () => {
    const out = visibleActions(staff, [
      { href: "/bookings/calendar", label: "Calendar" },
      { href: "/quotations/new", label: "Quotation" },
      { href: "/invoices", label: "Invoices" },
    ]);
    expect(out.map((a) => a.label)).toEqual(["Calendar"]);
  });

  it("an explicit permission is checked on top of the route permission", () => {
    // EVENT_COORDINATOR can open /leads but cannot create leads.
    expect(hasPermission("EVENT_COORDINATOR", "leads:read")).toBe(true);
    expect(hasPermission("EVENT_COORDINATOR", "leads:create")).toBe(false);
    const specs = [
      { href: "/leads/new", label: "New lead", permission: "leads:create" as const },
      { href: "/leads/import", label: "Import", permission: "leads:create" as const },
    ];
    expect(visibleActions({ user: { role: "EVENT_COORDINATOR" } }, specs)).toEqual([]);
    expect(visibleActions({ user: { role: "SALES_EXEC" } }, specs)).toEqual(specs);

    // Holding the explicit permission is not enough when middleware would
    // still bounce the route itself.
    const routeRevoked = { user: { role: "SALES_EXEC", permsDel: ["leads:read"] } };
    expect(visibleActions(routeRevoked, specs)).toEqual([]);
  });

  it("an explicit permission granted by an override shows the pill", () => {
    const granted = {
      user: { role: "EVENT_COORDINATOR", permsAdd: ["leads:create"] },
    };
    expect(
      visibleActions(granted, [{ href: "/leads/import", permission: "leads:create" as const }]),
    ).toHaveLength(1);
  });

  it("checks the pathname only: query strings and hashes are ignored", () => {
    const out = visibleActions(staff, [
      { href: "/quotations?status=SENT" },
      { href: "/invoices#overdue" },
      { href: "/bookings?view=calendar#today" },
    ]);
    expect(out.map((a) => a.href)).toEqual(["/bookings?view=calendar#today"]);
  });

  it("hrefs that are not app paths carry no route permission", () => {
    const hrefs = [
      "https://wa.me/919999999999",
      "//cdn.example.com/leads",
      "mailto:ops@example.com",
      "tel:+919999999999",
      "#top",
    ];
    expect(visibleActions(staff, hrefs.map((href) => ({ href }))).map((a) => a.href)).toEqual(hrefs);
  });

  it("with no session, only unrestricted actions survive", () => {
    const out = visibleActions(null, [
      { href: "/leads" },
      { href: "/dashboard" },
      { href: "/quotations/new", permission: null },
      { href: "/my-work", permission: "tasks:read" as const },
    ]);
    expect(out.map((a) => a.href)).toEqual(["/dashboard", "/quotations/new"]);
  });

  it("preserves order and identity, never mutates its input, and returns plain data", () => {
    const specs = [
      { href: "/bookings/new", label: "New booking", hint: "Add a booking", primary: true },
      { href: "/invoices", label: "Invoices" },
      { href: "/bookings/calendar", label: "Calendar", hint: "See the month" },
    ];
    const before = JSON.stringify(specs);
    const out = visibleActions(staff, specs);
    expect(out).toEqual([specs[0], specs[2]]);
    expect(out[0]).toBe(specs[0]);
    expect(JSON.stringify(specs)).toBe(before);
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it("accepts a next-auth-shaped session (extra user fields ignored)", () => {
    const session = {
      expires: "2099-01-01T00:00:00.000Z",
      user: { id: "u1", name: "Asha", email: "a@example.com", role: "SALES_EXEC", perms: undefined },
    };
    expect(visibleActions(session, [{ href: "/leads/import", permission: "leads:create" as const }])).toHaveLength(1);
  });
});
