import { describe, it, expect } from "vitest";
import { validateBalanced, fyForDate, periodForDate } from "./ledger";
import { COA_TEMPLATE } from "./coa-seed";

describe("validateBalanced — the balance invariant", () => {
  it("accepts a balanced two-line entry", () => {
    expect(validateBalanced([{ accountId: "a", debit: 100 }, { accountId: "b", credit: 100 }]).ok).toBe(true);
  });
  it("rejects an unbalanced entry", () => {
    const r = validateBalanced([{ accountId: "a", debit: 100 }, { accountId: "b", credit: 90 }]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unbalanced/i);
  });
  it("rejects fewer than two lines", () => {
    expect(validateBalanced([{ accountId: "a", debit: 100 }]).ok).toBe(false);
  });
  it("rejects a line that is both debit and credit", () => {
    expect(validateBalanced([{ accountId: "a", debit: 50, credit: 50 }, { accountId: "b", credit: 0, debit: 0 }]).ok).toBe(false);
  });
  it("rejects a zero line", () => {
    expect(validateBalanced([{ accountId: "a", debit: 100 }, { accountId: "b", credit: 100 }, { accountId: "c" }]).ok).toBe(false);
  });
  it("rejects negative amounts", () => {
    expect(validateBalanced([{ accountId: "a", debit: -100 }, { accountId: "b", credit: -100 }]).ok).toBe(false);
  });
  it("balances in integer paise (no float drift)", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in float — must still balance against 0.30
    expect(validateBalanced([{ accountId: "a", debit: 0.1 }, { accountId: "b", debit: 0.2 }, { accountId: "c", credit: 0.3 }]).ok).toBe(true);
  });
  it("balances a multi-line split", () => {
    expect(validateBalanced([
      { accountId: "a", debit: 1000 },
      { accountId: "b", credit: 847.46 },
      { accountId: "c", credit: 152.54 },
    ]).ok).toBe(true);
  });
});

describe("Indian financial-year helpers", () => {
  it("maps April into the new FY", () => {
    expect(fyForDate(new Date("2026-04-01T00:00:00Z"))).toBe("2026-27");
    expect(periodForDate(new Date("2026-04-15T00:00:00Z"))).toBe(1);
  });
  it("maps Jan–Mar into the prior FY", () => {
    expect(fyForDate(new Date("2026-02-10T00:00:00Z"))).toBe("2025-26");
    expect(periodForDate(new Date("2026-03-31T00:00:00Z"))).toBe(12);
  });
});

describe("CoA template integrity", () => {
  it("has unique account codes", () => {
    const codes = COA_TEMPLATE.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("covers all five account types", () => {
    const types = new Set(COA_TEMPLATE.map((c) => c.type));
    expect([...types].sort()).toEqual(["ASSET", "EQUITY", "EXPENSE", "INCOME", "LIABILITY"]);
  });
});
