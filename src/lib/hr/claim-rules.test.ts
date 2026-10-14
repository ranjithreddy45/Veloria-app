import { describe, expect, it } from "vitest";
import { employeeRouteScope, pickApproverRules } from "./claim-routing";
import { FUEL_CAP_STANDARD, checkFuelCap, claimMonthBounds, fuelCapMessage } from "./reimbursement";

describe("pickApproverRules", () => {
  const rules = [
    { level: 1, scope: "ALL", userId: "admin" },
    { level: 1, scope: "CATEGORY_EVENT", userId: "events-pool" },
    { level: 2, scope: "dept-sales", userId: "sales-head" },
    { level: 2, scope: "ALL", userId: "fallback-l2" },
    { level: 1, scope: employeeRouteScope("emp-dilkash"), userId: "venkat" },
    { level: 2, scope: employeeRouteScope("emp-dilkash"), userId: "meghana" },
    { level: 3, scope: employeeRouteScope("emp-dilkash"), userId: "amrutha" },
  ];

  it("a per-employee route wins at every level, for every category", () => {
    for (const category of ["FUEL", "TRAVEL", "EVENT"]) {
      const r = pickApproverRules(rules, { id: "emp-dilkash", departmentId: "dept-sales" }, category);
      expect([r.l1?.userId, r.l2?.userId, r.l3?.userId]).toEqual(["venkat", "meghana", "amrutha"]);
      expect(r.employeeRouted).toBe(true);
    }
  });

  it("everyone else keeps the default routing", () => {
    const r = pickApproverRules(rules, { id: "emp-other", departmentId: "dept-sales" }, "FUEL");
    expect([r.l1?.userId, r.l2?.userId, r.l3]).toEqual(["admin", "sales-head", null]);
    expect(r.employeeRouted).toBe(false);
  });

  it("keeps the event pool and the department fallback", () => {
    expect(pickApproverRules(rules, { id: "x", departmentId: null }, "EVENT").l1?.userId).toBe("events-pool");
    expect(pickApproverRules(rules, { id: "x", departmentId: "dept-hr" }, "FUEL").l2?.userId).toBe("fallback-l2");
  });

  it("works without an employee id (old callers) and with no rules at all", () => {
    expect(pickApproverRules(rules, { departmentId: "dept-sales" }).l1?.userId).toBe("admin");
    const none = pickApproverRules([], { id: "x", departmentId: null });
    expect([none.l1, none.l2, none.l3]).toEqual([null, null, null]);
  });
});

describe("checkFuelCap", () => {
  it("has no limit when the employee has no cap", () => {
    expect(checkFuelCap({ cap: null, alreadyClaimed: 99_999, amount: 50_000 })).toEqual({ ok: true });
  });

  it("allows exactly the cap and blocks one paisa over", () => {
    expect(checkFuelCap({ cap: 5500, alreadyClaimed: 3000, amount: 2500 }).ok).toBe(true);
    expect(checkFuelCap({ cap: 5500, alreadyClaimed: 3000, amount: 2500.01 }).ok).toBe(false);
  });

  it("blocks a single claim above the cap", () => {
    const r = checkFuelCap({ cap: 5500, alreadyClaimed: 0, amount: 7500 });
    expect(r.ok).toBe(false);
  });

  it("uses the agreed wording for the standard cap and adds what remains", () => {
    expect(fuelCapMessage(FUEL_CAP_STANDARD, 0)).toBe(
      "Your monthly fuel reimbursement limit is ₹5,500 (up to 50 litres). You cannot submit a claim exceeding this limit.",
    );
    expect(fuelCapMessage(FUEL_CAP_STANDARD, 4000)).toContain("already claimed ₹4,000 for this month, so ₹1,500 remains");
    expect(fuelCapMessage(6000, 0)).not.toContain("50 litres");
  });
});

describe("claimMonthBounds", () => {
  it("returns the UTC calendar month of the claim date", () => {
    const { from, to } = claimMonthBounds(new Date("2026-02-14T00:00:00.000Z"));
    expect(from.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(to.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});
