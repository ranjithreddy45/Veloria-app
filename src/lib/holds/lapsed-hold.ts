import type { Prisma } from "@prisma/client";

// ============================================================
// Lapsed holds: ONE decision, used everywhere a HOLD booking is judged.
// ------------------------------------------------------------
// A HOLD booking carries holdExpiresAt. Once that passes with no money
// against the booking, the hold has LAPSED: it must stop blocking the date for
// customers AND for the team, and it may be released (cancelled).
//
// Money means ANY of these, on ANY invoice of the booking (not just the token
// invoice):
//   - invoice.paidAmount > 0, or invoice status PAID / PARTIALLY_PAID
//   - a payment COMPLETED or PROCESSING
//   - a PENDING payment with an uploaded proof (awaiting staff verification)
//   - a PENDING payment created within CHECKOUT_GRACE_MS (a Razorpay checkout
//     that may be captured any second; customers pay at the last minute)
//
// A hold with money is NEVER lapsed. That rule exists because the daily sweep
// once cancelled paid holds and they vanished from the calendar. Leaving a
// hold in place costs a human a few seconds; cancelling a paid one loses a
// customer's event.
//
// The same rule is written twice on purpose — as a pure function (for rows
// already loaded) and as a Prisma `where` (for guarded, atomic updates) — and
// lapsed-hold.test.ts proves the two agree. Change both together.
//
// Pure module: no database, safe to import anywhere.
// ============================================================

/** How long a started-but-uncaptured checkout protects a hold. */
export const CHECKOUT_GRACE_MS = 15 * 60 * 1000;

type Moneyish = number | string | { toString(): string } | null | undefined;
type Dateish = Date | string | null | undefined;

export interface HoldPaymentFacts {
  status: string;
  receiptUploadedAt?: Dateish;
  createdAt?: Dateish;
}

export interface HoldInvoiceFacts {
  status: string;
  paidAmount: Moneyish;
  payments?: readonly HoldPaymentFacts[];
}

export interface HoldFacts {
  status: string;
  holdExpiresAt: Dateish;
  invoices?: readonly HoldInvoiceFacts[];
}

/** Booking fields to select so the pure functions below can decide. */
export const HOLD_FACTS_SELECT = {
  id: true,
  status: true,
  holdExpiresAt: true,
  invoices: {
    select: {
      status: true,
      paidAmount: true,
      payments: { select: { status: true, receiptUploadedAt: true, createdAt: true } },
    },
  },
} satisfies Prisma.BookingSelect;

function time(d: Dateish): number {
  if (d === null || d === undefined) return Number.NaN;
  return (d instanceof Date ? d : new Date(d)).getTime();
}

/** Mirrors Postgres: `paidAmount > 0` (a NaN numeric compares greater than 0). */
function positive(v: Moneyish): boolean {
  if (v === null || v === undefined) return false;
  const n = typeof v === "number" ? v : Number(v.toString());
  return !(n <= 0);
}

/**
 * "PAID": money has arrived. "PENDING": money may be arriving (checkout in
 * progress, proof awaiting verification). "NONE": nothing. Both PAID and
 * PENDING protect a hold from lapsing.
 */
export type HoldMoneyState = "PAID" | "PENDING" | "NONE";

export function holdMoneyState(invoices: readonly HoldInvoiceFacts[] | undefined, now: Date): HoldMoneyState {
  let pending = false;
  const graceStart = now.getTime() - CHECKOUT_GRACE_MS;
  for (const inv of invoices ?? []) {
    if (positive(inv.paidAmount) || inv.status === "PAID" || inv.status === "PARTIALLY_PAID") return "PAID";
    for (const p of inv.payments ?? []) {
      if (p.status === "COMPLETED") return "PAID";
      if (p.status === "PROCESSING") pending = true;
      else if (p.status === "PENDING" && (p.receiptUploadedAt != null || time(p.createdAt) > graceStart)) pending = true;
    }
  }
  return pending ? "PENDING" : "NONE";
}

/** true when any money has arrived or may be arriving. */
export function holdHasMoney(invoices: readonly HoldInvoiceFacts[] | undefined, now: Date): boolean {
  return holdMoneyState(invoices, now) !== "NONE";
}

/** A HOLD whose window has passed (money not considered). */
export function isHoldPastExpiry(b: Pick<HoldFacts, "status" | "holdExpiresAt">, now: Date): boolean {
  return b.status === "HOLD" && time(b.holdExpiresAt) < now.getTime();
}

/** THE decision: the hold window passed and no money is against the booking. */
export function isHoldLapsed(b: HoldFacts, now: Date = new Date()): boolean {
  return isHoldPastExpiry(b, now) && !holdHasMoney(b.invoices, now);
}

// ---- The same rule as Prisma filters (for guarded updates) -----------------

export function moneyPaymentWhere(now: Date): Prisma.PaymentWhereInput {
  return {
    OR: [
      { status: { in: ["COMPLETED", "PROCESSING"] } },
      { status: "PENDING", receiptUploadedAt: { not: null } },
      { status: "PENDING", createdAt: { gt: new Date(now.getTime() - CHECKOUT_GRACE_MS) } },
    ],
  };
}

export function moneyInvoiceWhere(now: Date): Prisma.InvoiceWhereInput {
  return {
    OR: [
      { paidAmount: { gt: 0 } },
      { status: { in: ["PAID", "PARTIALLY_PAID"] } },
      { payments: { some: moneyPaymentWhere(now) } },
    ],
  };
}

/** A HOLD with no money against it: safe to cancel (customer release). */
export function releasableHoldWhere(now: Date): Prisma.BookingWhereInput {
  return { status: "HOLD", invoices: { none: moneyInvoiceWhere(now) } };
}

/** A lapsed hold: releasable AND past its window. Use in every guarded cancel. */
export function lapsedHoldWhere(now: Date): Prisma.BookingWhereInput {
  return { ...releasableHoldWhere(now), holdExpiresAt: { not: null, lt: now } };
}

// ---- Customer-facing phase of a public hold ---------------------------------

export type HoldPhase =
  | "HELD" // on hold, window open, nothing paid yet
  | "PAYMENT_PENDING" // window passed but a payment is in flight / being verified
  | "PAYMENT_RECEIVED" // money arrived, booking still HOLD awaiting confirmation
  | "BOOKED" // the team's booking moved on (TENTATIVE / CONFIRMED / ...)
  | "LAPSED" // window passed with no payment
  | "RELEASED" // the customer released it
  | "CANCELLED"; // cancelled for another reason

const BOOKED_STATUSES = new Set(["TENTATIVE", "CONFIRMED", "IN_PROGRESS", "COMPLETED"]);

/**
 * Where a public hold stands, derived from the team's Booking (the source of
 * truth) and only falling back to the PublicHold row when no booking exists.
 */
export function holdPhase(
  input: { publicHoldStatus: string; publicHoldExpiresAt: Dateish; booking: HoldFacts | null },
  now: Date = new Date()
): HoldPhase {
  const b = input.booking;
  if (b) {
    if (BOOKED_STATUSES.has(b.status)) return "BOOKED";
    if (b.status === "HOLD") {
      const money = holdMoneyState(b.invoices, now);
      if (money === "PAID") return "PAYMENT_RECEIVED";
      if (!isHoldPastExpiry(b, now)) return "HELD";
      return money === "PENDING" ? "PAYMENT_PENDING" : "LAPSED";
    }
    // CANCELLED
    if (input.publicHoldStatus === "RELEASED") return "RELEASED";
    if (holdMoneyState(b.invoices, now) === "PAID") return "CANCELLED";
    const expiry = b.holdExpiresAt ?? input.publicHoldExpiresAt;
    if (input.publicHoldStatus === "EXPIRED" || time(expiry) < now.getTime()) return "LAPSED";
    return "CANCELLED";
  }
  switch (input.publicHoldStatus) {
    case "RELEASED":
      return "RELEASED";
    case "EXPIRED":
      return "LAPSED";
    case "PAID":
      return "PAYMENT_RECEIVED";
    case "CONFIRMED":
      return "BOOKED";
    default:
      return time(input.publicHoldExpiresAt) < now.getTime() ? "LAPSED" : "HELD";
  }
}
