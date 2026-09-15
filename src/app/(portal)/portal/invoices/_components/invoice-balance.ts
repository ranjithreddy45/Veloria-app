// ============================================================
// One invoice's balance in the old customer portal. The rule is finance's OWED
// rule as src/lib/finance/invoice-presentation.ts presents it, the one the
// team's screens, the team's print PDF, the portal PDF and the customer app's
// invoice document print too; this keeps the portal pages' shape of it:
//   SENT, PARTIALLY_PAID, OVERDUE: owed. The figure is its balanceDue.
//   PAID: settled. Nothing is due.
//   REFUNDED: the money went back. Nothing is due, even though a full refund
//     restores the stored balanceDue to the invoice total.
//   DRAFT, CANCELLED: not billed, and the portal does not list them.
// The owed figure is bookingBalance() over this one invoice, so a booking's
// invoice rows add up to its "Balance due" (getPortalBooking), the figure the
// customer app and the team booking page show. "Paid" and "Refunded" are the
// customer wording map's words (status-labels.ts), and StatusBadge's.
// Pure: no Prisma and no server-only imports.
// ============================================================

import { invoicePresentation } from "@/lib/finance/invoice-presentation";
import { CANCELLED_BOOKING_CHECKOUT_ERROR, bookingIsCancelled } from "@/lib/holds/checkout-guard";

export type InvoiceBalance =
  /** Owed: `amount` is still due (0 when nothing is left). */
  | { kind: "owed"; amount: number }
  /** Settled: nothing is due. */
  | { kind: "paid"; label: string }
  /** Refunded in full: nothing is due. */
  | { kind: "refunded"; label: string }
  /** Not billed (DRAFT, CANCELLED): nothing to show. */
  | { kind: "none" };

export function invoiceBalance(inv: { status: string; balanceDue: number }): InvoiceBalance {
  const shared = invoicePresentation(inv);
  if (shared.kind === "owed") return { kind: "owed", amount: shared.owed };
  if (shared.kind === "paid") return { kind: "paid", label: shared.balanceLabel };
  if (shared.kind === "refunded") return { kind: "refunded", label: shared.balanceLabel };
  return { kind: "none" };
}

/** Owed with a balance left: the only invoices the portal offers to pay (submitPaymentProof takes no others). */
export function hasAmountDue(inv: { status: string; balanceDue: number }): boolean {
  return invoicePresentation(inv).owed > 0;
}

export interface PortalPayState {
  /** Show the Pay button (and the payment proof upload). */
  payable: boolean;
  /** Why an owed invoice can't be paid here; null when it can, or when nothing is owed. */
  reason: string | null;
}

/**
 * Whether the portal offers to pay this invoice. Finance's owed rule first
 * (hasAmountDue), then the public pay links' rule for a cancelled booking: its
 * date is no longer reserved, so nothing is paid online on it, and the customer
 * is told why in the words POST /api/payments/create-order and the invoice link
 * refuse with. `bookingStatus` is the invoice's booking status; null or absent
 * when it has none.
 */
export function portalPayState(inv: { status: string; balanceDue: number; bookingStatus?: string | null }): PortalPayState {
  if (!hasAmountDue(inv)) return { payable: false, reason: null };
  if (inv.bookingStatus && bookingIsCancelled({ status: inv.bookingStatus })) {
    return { payable: false, reason: CANCELLED_BOOKING_CHECKOUT_ERROR };
  }
  return { payable: true, reason: null };
}
