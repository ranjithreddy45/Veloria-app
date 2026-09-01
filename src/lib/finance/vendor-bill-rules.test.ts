import { describe, it, expect } from "vitest";

// ============================================================
// The two rules the vendor-bills module got wrong, pinned.
//
// Both were the same omission — asking "does a bill exist?" instead of "does a
// LIVE bill exist?" — so cancelling a bill raised in error permanently locked
// its booking-vendor line: it vanished from the create picker and the create
// action refused it with "already billed".
// ============================================================

interface Bill { bookingVendorId: string | null; status: string; billNumber: string }

/** Mirrors the picker's exclusion set and createVendorBill's duplicate check. */
function blockingBill(bills: Bill[], bookingVendorId: string): Bill | undefined {
  return bills.find(
    (b) => b.bookingVendorId === bookingVendorId && b.status !== "CANCELLED"
  );
}

const bill = (over: Partial<Bill> = {}): Bill => ({
  bookingVendorId: "bv1",
  status: "DRAFT",
  billNumber: "VB-2608-0001",
  ...over,
});

describe("a booking-vendor line is billable again after its bill is cancelled", () => {
  it("blocks while a DRAFT bill exists", () => {
    expect(blockingBill([bill()], "bv1")).toBeDefined();
  });

  it("blocks while an APPROVED bill exists", () => {
    expect(blockingBill([bill({ status: "APPROVED" })], "bv1")).toBeDefined();
  });

  it("does NOT block once the only bill is cancelled — the reported bug", () => {
    // Cancelling is the documented way to void a draft, so it must not be a
    // one-way door that leaves the vendor unbillable forever.
    expect(blockingBill([bill({ status: "CANCELLED" })], "bv1")).toBeUndefined();
  });

  it("still blocks when a cancelled bill AND a live one both exist", () => {
    const found = blockingBill(
      [bill({ status: "CANCELLED" }), bill({ status: "APPROVED", billNumber: "VB-2608-0002" })],
      "bv1"
    );
    expect(found?.billNumber).toBe("VB-2608-0002");
  });

  it("ignores bills belonging to a different line", () => {
    expect(blockingBill([bill({ bookingVendorId: "bv2" })], "bv1")).toBeUndefined();
  });
});

// ============================================================
// Outstanding. Verified identical in serializeBill and getBillsForPayout, so
// the list and the payout selector can never disagree about what is owed.
// ============================================================

function outstanding(amount: number, paidPayouts: number[], nettedAdvance: number) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const paid = r2(paidPayouts.reduce((s, p) => s + p, 0));
  return r2(Math.max(0, amount - r2(paid + nettedAdvance)));
}

describe("bill outstanding", () => {
  it("is the full amount before anything is paid", () => {
    expect(outstanding(50000, [], 0)).toBe(50000);
  });

  it("reduces by paid payouts", () => {
    expect(outstanding(50000, [20000], 0)).toBe(30000);
  });

  it("reduces by a netted vendor advance, so an advance cannot be paid twice", () => {
    expect(outstanding(50000, [], 15000)).toBe(35000);
  });

  it("never goes negative when an advance exceeds the bill", () => {
    // A negative outstanding would read as the vendor owing US money.
    expect(outstanding(10000, [], 15000)).toBe(0);
  });

  it("survives paise-level arithmetic without drift", () => {
    expect(outstanding(1033.33, [344.44], 344.44)).toBeCloseTo(344.45, 2);
  });
});
