import { describe, it, expect } from "vitest";
import {
  CHECKOUT_GRACE_MS,
  holdMoneyState,
  holdPhase,
  isHoldLapsed,
  lapsedHoldWhere,
  releasableHoldWhere,
  type HoldFacts,
} from "./lapsed-hold";

const NOW = new Date("2026-09-16T10:00:00.000Z");
const PAST = new Date("2026-09-16T09:00:00.000Z");
const FUTURE = new Date("2026-09-16T13:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

const unpaidInvoice = { status: "SENT", paidAmount: "0", payments: [] };

// ---- Every shape the decision has to get right -----------------------------

const CASES: { name: string; b: HoldFacts; lapsed: boolean }[] = [
  { name: "expired hold, no invoices", b: { status: "HOLD", holdExpiresAt: PAST, invoices: [] }, lapsed: true },
  { name: "expired hold, token invoice unpaid", b: { status: "HOLD", holdExpiresAt: PAST, invoices: [unpaidInvoice] }, lapsed: true },
  { name: "hold still inside its window", b: { status: "HOLD", holdExpiresAt: FUTURE, invoices: [] }, lapsed: false },
  { name: "hold with no expiry", b: { status: "HOLD", holdExpiresAt: null, invoices: [] }, lapsed: false },
  { name: "expiry exactly now is not yet past", b: { status: "HOLD", holdExpiresAt: NOW, invoices: [] }, lapsed: false },
  { name: "confirmed booking", b: { status: "CONFIRMED", holdExpiresAt: PAST, invoices: [] }, lapsed: false },
  { name: "tentative booking", b: { status: "TENTATIVE", holdExpiresAt: PAST, invoices: [] }, lapsed: false },
  { name: "already cancelled", b: { status: "CANCELLED", holdExpiresAt: PAST, invoices: [] }, lapsed: false },
  // ---- the paid-hold regression, in every form money takes ----
  {
    name: "part payment below the auto-confirm threshold",
    b: { status: "HOLD", holdExpiresAt: PAST, invoices: [{ status: "PARTIALLY_PAID", paidAmount: "1000", payments: [] }] },
    lapsed: false,
  },
  {
    name: "money on a second invoice while the token invoice is unpaid",
    b: { status: "HOLD", holdExpiresAt: PAST, invoices: [unpaidInvoice, { status: "SENT", paidAmount: 1, payments: [] }] },
    lapsed: false,
  },
  {
    name: "invoice marked PAID",
    b: { status: "HOLD", holdExpiresAt: PAST, invoices: [{ status: "PAID", paidAmount: 0, payments: [] }] },
    lapsed: false,
  },
  {
    name: "completed payment not yet credited to the invoice",
    b: { status: "HOLD", holdExpiresAt: PAST, invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "COMPLETED", createdAt: minutesAgo(600) }] }] },
    lapsed: false,
  },
  {
    name: "payment processing at the gateway",
    b: { status: "HOLD", holdExpiresAt: PAST, invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PROCESSING", createdAt: minutesAgo(600) }] }] },
    lapsed: false,
  },
  {
    name: "payment proof uploaded, awaiting verification",
    b: {
      status: "HOLD",
      holdExpiresAt: PAST,
      invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: minutesAgo(600), createdAt: minutesAgo(600) }] }],
    },
    lapsed: false,
  },
  {
    name: "Razorpay checkout started a minute ago",
    b: { status: "HOLD", holdExpiresAt: PAST, invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(1) }] }] },
    lapsed: false,
  },
  {
    name: "abandoned checkout older than the grace window",
    b: {
      status: "HOLD",
      holdExpiresAt: PAST,
      invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(CHECKOUT_GRACE_MS / 60000 + 1) }] }],
    },
    lapsed: true,
  },
  {
    name: "failed and refunded payments are not money on the booking",
    b: {
      status: "HOLD",
      holdExpiresAt: PAST,
      invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "FAILED", createdAt: minutesAgo(600) }, { status: "REFUNDED", createdAt: minutesAgo(600) }] }],
    },
    lapsed: true,
  },
  { name: "ISO strings from JSON behave like Dates", b: { status: "HOLD", holdExpiresAt: PAST.toISOString(), invoices: [] }, lapsed: true },
];

describe("isHoldLapsed", () => {
  for (const c of CASES) {
    it(`${c.lapsed ? "LAPSED" : "not lapsed"}: ${c.name}`, () => {
      expect(isHoldLapsed(c.b, NOW)).toBe(c.lapsed);
    });
  }
});

describe("holdMoneyState", () => {
  it("separates money received from money that may be arriving", () => {
    expect(holdMoneyState([{ status: "SENT", paidAmount: "5000", payments: [] }], NOW)).toBe("PAID");
    expect(holdMoneyState([{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", createdAt: minutesAgo(2) }] }], NOW)).toBe("PENDING");
    expect(holdMoneyState([unpaidInvoice], NOW)).toBe("NONE");
    expect(holdMoneyState(undefined, NOW)).toBe("NONE");
  });
});

// ---- The Prisma filter must say exactly what the function says -------------
// A tiny evaluator for the operators the filters use. An operator it doesn't
// know throws, so a reshaped filter fails here instead of silently diverging.

type Row = Record<string, unknown>;

function cmp(v: unknown): number {
  return v instanceof Date ? v.getTime() : Number(v);
}

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Record<string, unknown>[]).some((w) => matches(row, w));
    if (key === "AND") return (cond as Record<string, unknown>[]).every((w) => matches(row, w));
    if (key === "NOT") return !matches(row, cond as Record<string, unknown>);
    const value = row[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      return Object.entries(cond as Record<string, unknown>).every(([op, arg]) => {
        switch (op) {
          case "in":
            return (arg as unknown[]).includes(value);
          case "not":
            if (arg !== null) throw new Error("only { not: null } is supported");
            return value !== null && value !== undefined;
          case "lt":
            return value !== null && value !== undefined && cmp(value) < cmp(arg);
          case "gt":
            return value !== null && value !== undefined && cmp(value) > cmp(arg);
          case "some":
            return ((value as Row[] | undefined) ?? []).some((r) => matches(r, arg as Record<string, unknown>));
          case "none":
            return !((value as Row[] | undefined) ?? []).some((r) => matches(r, arg as Record<string, unknown>));
          default:
            throw new Error(`evaluator does not support operator "${op}"`);
        }
      });
    }
    return value === cond;
  });
}

/** Fill the columns a real row always has, the way Postgres would. */
function asRow(b: HoldFacts): Row {
  return {
    status: b.status,
    holdExpiresAt: b.holdExpiresAt ? new Date(b.holdExpiresAt) : null,
    invoices: (b.invoices ?? []).map((i) => ({
      status: i.status,
      paidAmount: Number(i.paidAmount ?? 0),
      payments: (i.payments ?? []).map((p) => ({
        status: p.status,
        receiptUploadedAt: p.receiptUploadedAt ? new Date(p.receiptUploadedAt) : null,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(0),
      })),
    })),
  };
}

describe("lapsedHoldWhere agrees with isHoldLapsed", () => {
  for (const c of CASES) {
    it(c.name, () => {
      expect(matches(asRow(c.b), lapsedHoldWhere(NOW) as Record<string, unknown>)).toBe(isHoldLapsed(c.b, NOW));
    });
  }

  it("releasableHoldWhere ignores the window but still refuses money", () => {
    const early: HoldFacts = { status: "HOLD", holdExpiresAt: FUTURE, invoices: [unpaidInvoice] };
    const paidEarly: HoldFacts = { status: "HOLD", holdExpiresAt: FUTURE, invoices: [{ status: "SENT", paidAmount: 10, payments: [] }] };
    expect(matches(asRow(early), releasableHoldWhere(NOW) as Record<string, unknown>)).toBe(true);
    expect(matches(asRow(paidEarly), releasableHoldWhere(NOW) as Record<string, unknown>)).toBe(false);
  });
});

// ---- What the customer is told ---------------------------------------------

describe("holdPhase", () => {
  const phase = (publicHoldStatus: string, booking: HoldFacts | null, publicHoldExpiresAt: Date | null = PAST) =>
    holdPhase({ publicHoldStatus, publicHoldExpiresAt, booking }, NOW);

  it("an open, unpaid hold is HELD", () => {
    expect(phase("SLOT_CLAIMED", { status: "HOLD", holdExpiresAt: FUTURE, invoices: [unpaidInvoice] }, FUTURE)).toBe("HELD");
  });

  it("an unpaid hold past its window is LAPSED even before any job runs", () => {
    expect(phase("SLOT_CLAIMED", { status: "HOLD", holdExpiresAt: PAST, invoices: [unpaidInvoice] })).toBe("LAPSED");
  });

  it("a hold released by a job reads LAPSED", () => {
    expect(phase("EXPIRED", { status: "CANCELLED", holdExpiresAt: PAST, invoices: [unpaidInvoice] })).toBe("LAPSED");
    expect(phase("SLOT_CLAIMED", { status: "CANCELLED", holdExpiresAt: PAST, invoices: [unpaidInvoice] })).toBe("LAPSED");
  });

  it("never tells a paying customer their hold lapsed", () => {
    const paid = { status: "SENT", paidAmount: "5000", payments: [] };
    expect(phase("SLOT_CLAIMED", { status: "HOLD", holdExpiresAt: PAST, invoices: [paid] })).toBe("PAYMENT_RECEIVED");
    const inFlight = { status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", createdAt: minutesAgo(3) }] };
    expect(phase("SLOT_CLAIMED", { status: "HOLD", holdExpiresAt: PAST, invoices: [inFlight] })).toBe("PAYMENT_PENDING");
  });

  it("follows the team's booking once it moves on, whatever the hold row says", () => {
    expect(phase("EXPIRED", { status: "CONFIRMED", holdExpiresAt: PAST, invoices: [] })).toBe("BOOKED");
    expect(phase("SLOT_CLAIMED", { status: "TENTATIVE", holdExpiresAt: PAST, invoices: [] })).toBe("BOOKED");
  });

  it("distinguishes a customer release from a team cancellation", () => {
    expect(phase("RELEASED", { status: "CANCELLED", holdExpiresAt: FUTURE, invoices: [] }, FUTURE)).toBe("RELEASED");
    expect(phase("SLOT_CLAIMED", { status: "CANCELLED", holdExpiresAt: FUTURE, invoices: [] }, FUTURE)).toBe("CANCELLED");
  });

  it("a cancelled booking that had money on it is CANCELLED, not LAPSED", () => {
    expect(phase("SLOT_CLAIMED", { status: "CANCELLED", holdExpiresAt: PAST, invoices: [{ status: "PAID", paidAmount: 5000, payments: [] }] })).toBe("CANCELLED");
  });

  it("falls back to the hold row only when there is no booking", () => {
    expect(phase("SLOT_CLAIMED", null, FUTURE)).toBe("HELD");
    expect(phase("SLOT_CLAIMED", null, PAST)).toBe("LAPSED");
    expect(phase("RELEASED", null)).toBe("RELEASED");
  });
});
