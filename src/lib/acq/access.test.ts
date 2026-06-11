import { describe, it, expect } from "vitest";
import { ROLE_PERMISSIONS, hasPermission } from "@/lib/permissions";
import { acqHasAnyAccess, acqCan } from "./rbac";

// Regression guard for the critical "BD CRM unreachable by its roles" bug:
// the 4 BD roles must (a) exist in ROLE_PERMISSIONS with owners:read so the
// nav renders, and (b) pass the BD RBAC checks.
const BD_ROLES = ["BD_EXECUTIVE", "BD_HEAD", "OPERATIONS", "LEGAL"] as const;

describe("BD role access wiring", () => {
  it("every BD role exists in ROLE_PERMISSIONS", () => {
    for (const r of BD_ROLES) expect(ROLE_PERMISSIONS[r]).toBeDefined();
  });

  it("every BD role can read owners (so the BD nav + pages render)", () => {
    for (const r of BD_ROLES) expect(hasPermission(r, "owners:read")).toBe(true);
  });

  it("every BD role has BD CRM access", () => {
    for (const r of BD_ROLES) expect(acqHasAnyAccess(r)).toBe(true);
  });

  it("only BD Head / Admin can approve a deal", () => {
    expect(acqCan("BD_HEAD", "bdhead:approve")).toBe(true);
    expect(acqCan("ADMIN", "bdhead:approve")).toBe(true);
    expect(acqCan("BD_EXECUTIVE", "bdhead:approve")).toBe(false);
  });

  it("only Operations / BD Head / Admin can publish inventory", () => {
    expect(acqCan("OPERATIONS", "property:available")).toBe(true);
    expect(acqCan("BD_HEAD", "property:available")).toBe(true);
    expect(acqCan("LEGAL", "property:available")).toBe(false);
  });
});
