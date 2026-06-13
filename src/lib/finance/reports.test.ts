import { describe, it, expect } from "vitest";
import { normalBalance, accountNet, buildProfitAndLoss, buildBalanceSheet } from "./reports";

describe("normalBalance / accountNet", () => {
  it("debit-normal for assets & expenses", () => {
    expect(normalBalance("ASSET")).toBe("debit");
    expect(normalBalance("EXPENSE")).toBe("debit");
    expect(accountNet("ASSET", 1000, 200)).toBe(800);
  });
  it("credit-normal for liabilities, equity, income", () => {
    expect(normalBalance("INCOME")).toBe("credit");
    expect(accountNet("INCOME", 0, 5000)).toBe(5000);
    expect(accountNet("LIABILITY", 100, 900)).toBe(800);
  });
});

describe("buildProfitAndLoss", () => {
  it("nets income and expense and computes profit", () => {
    const pl = buildProfitAndLoss([
      { code: "4010", name: "Venue Rental", type: "INCOME", debit: 0, credit: 100000 },
      { code: "5010", name: "Catering Cost", type: "EXPENSE", debit: 40000, credit: 0 },
      { code: "1020", name: "Bank", type: "ASSET", debit: 100000, credit: 0 }, // ignored in P&L
    ]);
    expect(pl.totalIncome).toBe(100000);
    expect(pl.totalExpense).toBe(40000);
    expect(pl.netProfit).toBe(60000);
    expect(pl.income).toHaveLength(1);
    expect(pl.expense).toHaveLength(1);
  });
});

describe("buildBalanceSheet", () => {
  it("balances assets against liabilities + equity incl. retained earnings", () => {
    // Bank 60,000 asset; equity share capital 0; net profit 60,000 retained.
    const bs = buildBalanceSheet(
      [
        { code: "1020", name: "Bank", type: "ASSET", debit: 60000, credit: 0 },
      ],
      60000,
    );
    expect(bs.totalAssets).toBe(60000);
    expect(bs.totalEquity).toBe(60000);
    expect(bs.balanced).toBe(true);
  });
  it("flags an unbalanced sheet", () => {
    const bs = buildBalanceSheet([{ code: "1020", name: "Bank", type: "ASSET", debit: 100, credit: 0 }], 0);
    expect(bs.balanced).toBe(false);
  });
});
