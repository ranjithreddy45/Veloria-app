// ============================================================
// Split payments — server-side rules + the capture-time settle hook.
// ------------------------------------------------------------
// The invoice is the parent "amount due" (parentLinkId = Invoice.id). Rules:
//   • Σ PENDING (unexpired) splits + any new split ≤ invoice.balanceDue.
//     balanceDue is ALREADY net of paid splits (they record normal Payments),
//     so this is exactly "PENDING + PAID never exceeds what was owed".
//   • A split becomes PAID only through applyRazorpayCapture — the single
//     shared browser-verify + webhook path — via settleSplitOnCapture below.
// Money is integer paise throughout; Decimal ↔ paise only at the boundary.
// ============================================================

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { reportSystemFailure } from "@/lib/ops-alert";
import {
  formatPaise,
  rupeesToPaise,
  splitEffectiveStatus,
  type SplitRow,
} from "@/lib/payments/split-format";

/** How long a split link stays payable after it's created. */
export const SPLIT_LINK_TTL_DAYS = 14;

/** Invoice states cash may be collected against (mirrors recordPayment). */
export const SPLIT_PAYABLE_INVOICE_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"] as const;

/** Smallest split Razorpay will accept (₹1). */
export const MIN_SPLIT_PAISE = 100;

/** Unguessable, URL-safe public credential (32 chars). */
export function newSplitToken(): string {
  return randomBytes(24).toString("base64url");
}

export function splitLinkUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/pay/split/${token}`;
}

/** Σ amountPaise of live (PENDING, unexpired) splits on an invoice. */
export function sumReservedPaise(
  splits: { amountPaise: number; status: string; expiresAt: Date | null }[]
): number {
  return splits.reduce(
    (s, x) => (splitEffectiveStatus(x) === "PENDING" ? s + x.amountPaise : s),
    0
  );
}

type SplitRecord = {
  id: string;
  token: string;
  payerName: string;
  payerPhone: string | null;
  payerEmail: string | null;
  amountPaise: number;
  status: string;
  paidAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: string | null;
};

/** DB row → UI row (effective status, ISO dates, public URL). */
export function toSplitRow(s: SplitRecord): SplitRow {
  return {
    id: s.id,
    payerName: s.payerName,
    payerPhone: s.payerPhone,
    payerEmail: s.payerEmail,
    amountPaise: s.amountPaise,
    status: splitEffectiveStatus(s),
    paidAt: s.paidAt ? s.paidAt.toISOString() : null,
    expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    createdBy: s.createdBy === "HOST" || s.createdBy === "STAFF" ? s.createdBy : null,
    url: splitLinkUrl(s.token),
  };
}

// ============================================================
// Capture hook — called from applyRazorpayCapture AFTER the invoice has been
// credited exactly once. Idempotent: the status-guarded updateMany means a
// second run (browser verify + webhook both fire) is a no-op, so the host and
// staff are notified exactly once.
// ============================================================
export async function settleSplitOnCapture(opts: {
  paymentId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
}): Promise<void> {
  const split = await prisma.paymentSplit.findFirst({
    where: { razorpayOrderId: opts.razorpayOrderId },
    select: {
      id: true,
      status: true,
      amountPaise: true,
      payerName: true,
      invoiceId: true,
      parentLinkId: true,
      bookingId: true,
      createdById: true,
      createdBy: true,
    },
  });
  if (!split) return; // an ordinary (non-split) capture

  // Money WAS captured: whatever the split says (PENDING, or CANCELLED /
  // EXPIRED because a checkout stayed open past a cancel), the truthful state
  // is PAID. Only a row that is already PAID is left alone.
  const flipped = await prisma.paymentSplit.updateMany({
    where: { id: split.id, status: { not: "PAID" } },
    data: {
      status: "PAID",
      paidAt: new Date(),
      razorpayPaymentId: opts.razorpayPaymentId || undefined,
    },
  });
  if (flipped.count !== 1) return; // already settled by the other capture path

  const invoiceId = split.invoiceId ?? split.parentLinkId;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      paidAmount: true,
      balanceDue: true,
      createdById: true,
      contact: { select: { email: true } },
      booking: { select: { id: true, eventName: true, createdById: true } },
    },
  });
  if (!invoice) return;

  // Webhook-time re-check of the split invariant. The capture itself is
  // guarded at order creation (amount ≤ balance, Σ pending ≤ balance); if the
  // invoice still ended up over-collected (e.g. a manual payment landed while
  // a checkout was open), finance must know — the money is already captured,
  // so this alerts rather than blocks.
  const paidPaise = rupeesToPaise(Number(invoice.paidAmount));
  const totalPaise = rupeesToPaise(Number(invoice.totalAmount));
  if (paidPaise > totalPaise + 1) {
    void reportSystemFailure({
      area: "Split payments",
      title: "Split payment over-collected an invoice",
      detail: `Invoice ${invoice.invoiceNumber}: paid ${formatPaise(paidPaise)} vs total ${formatPaise(totalPaise)} after split ${split.id} (${split.payerName}). Refund the excess.`,
      actionUrl: `/invoices/${invoice.id}`,
    });
  }

  // ---- Notify the host (portal users on the invoice's contact) + staff ----
  const hostIds = new Set<string>();
  const staffIds = new Set<string>();
  if (invoice.contact?.email) {
    const hosts = await prisma.user.findMany({
      where: { email: invoice.contact.email, emailVerified: { not: null }, isActive: true },
      select: { id: true },
    });
    for (const h of hosts) hostIds.add(h.id);
  }
  if (split.createdById) {
    (split.createdBy === "HOST" ? hostIds : staffIds).add(split.createdById);
  }
  if (invoice.booking?.createdById) staffIds.add(invoice.booking.createdById);
  if (invoice.createdById) staffIds.add(invoice.createdById);
  for (const id of hostIds) staffIds.delete(id);

  const eventLabel = invoice.booking?.eventName ?? `invoice ${invoice.invoiceNumber}`;
  const remaining = rupeesToPaise(Number(invoice.balanceDue));
  const amountLabel = formatPaise(split.amountPaise);
  const remainingLine =
    remaining <= 0 ? "That settles the invoice in full." : `${formatPaise(remaining)} still due.`;

  // Awaited: this runs inside the webhook, where a fire-and-forget write can
  // be dropped on function freeze.
  await Promise.all([
    ...[...hostIds].map((userId) =>
      notifyAwait({
        userId,
        type: "PAYMENT_RECEIVED",
        title: `${split.payerName} paid ${amountLabel}`,
        message: `Their share towards ${eventLabel} has come through. ${remainingLine}`,
        actionUrl: "/portal/payments",
        metadata: { splitId: split.id, paymentId: opts.paymentId, invoiceId: invoice.id },
      })
    ),
    ...[...staffIds].map((userId) =>
      notifyAwait({
        userId,
        type: "PAYMENT_RECEIVED",
        title: `Split payment received — ${amountLabel}`,
        message: `${split.payerName} paid their share of ${invoice.invoiceNumber} (${eventLabel}). ${remainingLine}`,
        actionUrl: invoice.booking?.id ? `/bookings/${invoice.booking.id}` : `/invoices/${invoice.id}`,
        metadata: { splitId: split.id, paymentId: opts.paymentId, invoiceId: invoice.id },
      })
    ),
  ]);
}
