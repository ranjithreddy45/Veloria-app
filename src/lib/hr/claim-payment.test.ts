import { describe, expect, it } from "vitest";
import { checkPayment, mayMarkClaimPaid, paymentSummary, todayIst } from "./claim-payment";

// 14 Nov 2026, 20:00 UTC = 15 Nov 01:30 in India.
const NOW = new Date("2026-11-14T20:00:00.000Z");
const ok = { paidOn: "2026-11-14", amount: 1200, mode: "UPI", reference: "UTR412398" };

describe("mayMarkClaimPaid", () => {
  it("only the FINANCE role", () => {
    expect(mayMarkClaimPaid("FINANCE")).toBe(true);
    for (const r of ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "SALES_HEAD", undefined, null, ""]) {
      expect(mayMarkClaimPaid(r)).toBe(false);
    }
  });
});

describe("checkPayment", () => {
  it("accepts a complete payment", () => {
    const r = checkPayment(ok, 1200, NOW);
    expect(r).toMatchObject({ ok: true, amount: 1200, mode: "UPI", reference: "UTR412398" });
    if (r.ok) expect(r.paidAt.toISOString()).toBe("2026-11-14T00:00:00.000Z");
  });
  it("requires every field", () => {
    expect(checkPayment({ ...ok, paidOn: "" }, 1200, NOW)).toMatchObject({ ok: false, error: "Enter the payment date." });
    expect(checkPayment({ ...ok, amount: "" }, 1200, NOW)).toMatchObject({ ok: false, error: "Enter the amount paid." });
    expect(checkPayment({ ...ok, mode: "" }, 1200, NOW).ok).toBe(false);
    expect(checkPayment({ ...ok, reference: "  " }, 1200, NOW)).toMatchObject({ ok: false, error: "Enter the transaction or UTR reference number." });
  });
  it("judges 'future' by the date in India, not UTC", () => {
    // 15 Nov is already today in India at NOW.
    expect(checkPayment({ ...ok, paidOn: "2026-11-15" }, 1200, NOW).ok).toBe(true);
    expect(checkPayment({ ...ok, paidOn: "2026-11-16" }, 1200, NOW).ok).toBe(false);
    expect(todayIst(NOW)).toBe("2026-11-15");
  });
  it("rejects impossible dates, bad modes and amounts above the claim", () => {
    expect(checkPayment({ ...ok, paidOn: "2026-02-30" }, 1200, NOW).ok).toBe(false);
    expect(checkPayment({ ...ok, mode: "CHEQUE" }, 1200, NOW).ok).toBe(false);
    expect(checkPayment({ ...ok, amount: 1200.01 }, 1200, NOW).ok).toBe(false);
    expect(checkPayment({ ...ok, amount: -5 }, 1200, NOW).ok).toBe(false);
    expect(checkPayment({ ...ok, amount: 10.555 }, 1200, NOW).ok).toBe(false);
  });
  it("allows a partial payment and an amount typed with commas", () => {
    expect(checkPayment({ ...ok, amount: "1,000.50" }, 1200, NOW)).toMatchObject({ ok: true, amount: 1000.5 });
  });
});

describe("paymentSummary", () => {
  it("shows date, mode, amount and reference", () => {
    expect(paymentSummary({ paidAt: "2026-11-14T00:00:00.000Z", paymentMode: "BANK_TRANSFER", paidAmount: 1200, paymentRef: "UTR1" }))
      .toBe("Paid 14 Nov 2026 · Bank transfer · ₹1,200.00 · Ref UTR1");
  });
  it("leaves out what an older payment never recorded", () => {
    expect(paymentSummary({ paidAt: "2026-10-01T00:00:00.000Z", paymentRef: null })).toBe("Paid 1 Oct 2026");
    expect(paymentSummary({ paidAt: null })).toBeNull();
  });
});
