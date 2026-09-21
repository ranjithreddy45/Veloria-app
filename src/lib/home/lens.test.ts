import { describe, it, expect } from "vitest";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { resolveLens, seesWholeTeam } from "./lens";

describe("resolveLens", () => {
  it("maps the named roles", () => {
    expect(resolveLens("SUPER_ADMIN")).toBe("owner");
    expect(resolveLens("ADMIN")).toBe("owner");
    expect(resolveLens("SALES_EXEC")).toBe("sales");
    expect(resolveLens("SALES_HEAD")).toBe("sales");
    expect(resolveLens("OPERATIONS_HEAD")).toBe("ops");
    expect(resolveLens("PROPERTY_MANAGER")).toBe("ops");
    expect(resolveLens("EVENT_COORDINATOR")).toBe("ops");
    expect(resolveLens("FINANCE")).toBe("finance");
    expect(resolveLens("STAFF")).toBe("staff");
  });

  it("falls back to the general lens for unknown or missing roles", () => {
    expect(resolveLens("SOMETHING_NEW")).toBe("staff");
    expect(resolveLens(undefined)).toBe("staff");
    expect(resolveLens(null)).toBe("staff");
    expect(resolveLens("")).toBe("staff");
  });

  it("gives every role in the permission table a lens", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS)) {
      expect(["owner", "sales", "ops", "finance", "staff"]).toContain(resolveLens(role));
    }
  });

  it("keeps the auditor off the finance lens, which needs invoices:read", () => {
    expect(ROLE_PERMISSIONS.AUDITOR).not.toContain("invoices:read");
    expect(resolveLens("AUDITOR")).toBe("staff");
  });
});

describe("seesWholeTeam", () => {
  it("scopes a rep to their own book and managers to the team", () => {
    expect(seesWholeTeam("SALES_EXEC")).toBe(false);
    expect(seesWholeTeam("SALES_HEAD")).toBe(true);
    expect(seesWholeTeam("ADMIN")).toBe(true);
    expect(seesWholeTeam(undefined)).toBe(false);
  });
});
