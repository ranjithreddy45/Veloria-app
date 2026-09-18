// ============================================================
// Split payments — client-safe types + money/format helpers.
// ------------------------------------------------------------
// Imported by BOTH server code and "use client" components, so this file must
// stay free of prisma / server-only imports. All money is integer paise; only
// the formatter converts to rupees, at the display boundary.
// ============================================================

export type SplitStatus = "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";

/** One split row as shown in the host portal / staff booking page. */
export interface SplitRow {
  id: string;
  payerName: string;
  payerPhone: string | null;
  payerEmail: string | null;
  amountPaise: number;
  status: SplitStatus;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: "HOST" | "STAFF" | null;
  /** Shareable public URL — /pay/split/<token>. */
  url: string;
}

/** One "amount due" a host/staff member can split, with its existing splits. */
export interface SplitTarget {
  invoiceId: string;
  invoiceNumber: string;
  bookingId: string | null;
  eventName: string | null;
  /** invoice.balanceDue in paise — already net of every COMPLETED payment (paid splits included). */
  outstandingPaise: number;
  /** Σ PENDING (unexpired) split amounts — reserved, not yet collected. */
  reservedPaise: number;
  /** outstanding − reserved: the most that can still be handed to new payers. */
  availablePaise: number;
  /** Earliest unpaid installment (staged plan), clamped to the balance — a handy default. */
  nextDue: { label: string; amountPaise: number } | null;
  splits: SplitRow[];
}

/** One payer as submitted from the split dialog (server re-validates). */
export interface CreateSplitPayerInput {
  name: string;
  phone?: string;
  email?: string;
  amountPaise: number;
}

/** What the public /pay/split/<token> page is allowed to see. */
export interface PublicSplitView {
  id: string;
  payerName: string;
  payerPhone: string;
  payerEmail: string;
  amountPaise: number;
  status: SplitStatus;
  paidAt: string | null;
  expiresAt: string | null;
  invoiceId: string;
  invoiceNumber: string;
  eventName: string | null;
  eventDate: string | null;
  hostName: string;
  /** Invoice still open for collection (status + live booking + balance > 0). */
  invoicePayable: boolean;
  /** The share is larger than what's now left on the invoice — can't be paid as-is. */
  exceedsOutstanding: boolean;
  outstandingPaise: number;
  url: string;
}

/** Rupees (number) → integer paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Integer paise → rupees for a Decimal(12,2) column. */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * ₹ formatter for paise. Shows decimals only when the amount actually has
 * paise (₹12,500 vs ₹12,500.50) so whole-rupee splits read cleanly.
 */
export function formatPaise(paise: number): string {
  const safe = Number.isFinite(paise) ? paise : 0;
  const hasPaise = safe % 100 !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safe / 100);
}

/**
 * Split `totalPaise` equally across `n` payers with NO rounding loss: the
 * first `remainder` payers get one extra paisa so the parts sum exactly.
 */
export function equalSplitPaise(totalPaise: number, n: number): number[] {
  const count = Math.max(1, Math.floor(n));
  const total = Math.max(0, Math.floor(totalPaise));
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * A PENDING split whose expiry has passed is EXPIRED — computed, never
 * flipped by a cron, so there is no window where a stale row looks live.
 */
export function splitEffectiveStatus(s: {
  status: string;
  expiresAt: Date | string | null;
}): SplitStatus {
  if (s.status === "PENDING" && s.expiresAt) {
    const t = new Date(s.expiresAt).getTime();
    if (Number.isFinite(t) && t < Date.now()) return "EXPIRED";
  }
  if (s.status === "PAID" || s.status === "CANCELLED" || s.status === "EXPIRED") return s.status;
  return "PENDING";
}

/** Prefilled WhatsApp share text for one payer's link. */
export function splitWhatsAppText(opts: {
  payerName: string;
  requesterName: string;
  amountPaise: number;
  eventName: string | null;
  invoiceNumber: string;
  url: string;
}): string {
  const towards = opts.eventName ? `towards ${opts.eventName}` : `towards invoice ${opts.invoiceNumber}`;
  return `Hi ${opts.payerName}, ${opts.requesterName} has requested ${formatPaise(opts.amountPaise)} ${towards} at Veloria Grand. Pay securely here (UPI, card or net banking):\n${opts.url}`;
}

/** wa.me deep link; without a phone it opens WhatsApp's own contact picker. */
export function whatsAppShareHref(phone: string | null | undefined, text: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

/**
 * The pending Payment minted for a split's Razorpay order names the split, so a
 * capture on an order the split later replaced (a reopened checkout got a newer
 * order) still settles the right share instead of leaving it unpaid.
 */
export function splitPaymentNote(payerName: string, splitId: string): string {
  return `Split payment by ${payerName} [split:${splitId}]`;
}

/** The split id written by splitPaymentNote, or null for any other payment note. */
export function splitIdFromPaymentNotes(notes: string | null | undefined): string | null {
  const m = notes?.match(/\[split:([A-Za-z0-9_-]+)\]/);
  return m ? m[1] : null;
}
