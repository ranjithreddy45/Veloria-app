// ============================================================
// Quote Radar — customer-safe public projection (single chokepoint).
// ------------------------------------------------------------
// The ONLY place a QuoteShareLink + its frozen SalesQuotation.outputsJson are
// mapped to what the public /q/<token> page may see. Routing every public read
// through this mapper guarantees no internal field (leadId, rep identity,
// internal notes, cost/margin, other quotations) can ever leak — a single
// over-broad select elsewhere would expose pipeline data to anyone with the
// link (see the spec's PII-leak risk).
//
// Pure: no IO, no "use server". Takes already-loaded rows, returns plain data.
// ============================================================

import { computeQuotation, type QuotationInput, type QuotationResult } from "@/lib/sales/quotation-calc";
import { SLOT_LABEL, plannerSlotToEnum } from "@/lib/sales/slot";

/** A customer-safe line on the public quote. No internal/cost detail. */
export interface PublicQuoteLine {
  sl: number;
  particulars: string;
  plan: string;
  amount: number;
}

/** A customer-safe payment installment row. */
export interface PublicQuoteInstallment {
  label: string;
  pct: number;
  amount: number;
  dueHint: string;
}

/** Everything the public /q/<token> page is allowed to render. */
export interface PublicQuoteView {
  token: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  active: boolean;
  // Customer-safe headline (first name only — never full identity / PII).
  clientFirstName: string;
  occasion: string | null;
  eventDateISO: string | null;
  timeSlot: string | null;
  slotLabel: string | null;
  // Frozen money breakdown (read from outputsJson, never recomputed for price).
  lines: PublicQuoteLine[];
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  taxRate: number;
  tax: number;
  grandTotal: number;
  paymentSchedule: PublicQuoteInstallment[];
  currency: string;
  // One-tap pay surface (rendered only if present; owned by feature 2).
  payInvoiceId: string | null;
  paymentLinkUrl: string | null;
  // The 20% booking-advance figure, for the "Pay to hold your date" CTA label.
  advanceAmount: number | null;
  // Social-proof toggle (feature 4) — the page decides whether to fetch reviews.
  showSocialProof: boolean;
}

/** The subset of a QuoteShareLink row this mapper needs (avoids a wide select). */
export interface ShareLinkForView {
  token: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  clientName: string | null;
  occasion: string | null;
  eventDate: Date | null;
  timeSlot: string | null;
  currency: string;
  showSocialProof: boolean;
  payInvoiceId: string | null;
  paymentLinkUrl: string | null;
  expiresAt: Date | null;
}

/** The subset of a SalesQuotation row needed to render the frozen breakdown. */
export interface PrimaryQuotationForView {
  inputsJson: unknown;
  outputsJson: unknown;
}

/** Format a Date (read back as UTC-midnight @db.Date) to YYYY-MM-DD, no TZ drift. */
function toUTCDateISO(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** First name only — strips any surname/PII from the denormalised clientName. */
function firstNameOnly(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "there";
  return n.split(/\s+/)[0] || "there";
}

/**
 * Resolve the frozen QuotationResult to render. outputsJson is set at APPROVED;
 * if it is somehow absent we recompute from inputsJson (mirroring the internal
 * quotation-detail fallback) so the page never renders blank. Pricing for the
 * customer always comes from this single source of truth, never re-derived
 * field-by-field.
 */
export function resolveQuotationResult(q: PrimaryQuotationForView | null | undefined): QuotationResult | null {
  if (!q) return null;
  const frozen = q.outputsJson as QuotationResult | null;
  if (frozen && Array.isArray(frozen.lines)) return frozen;
  try {
    const input = q.inputsJson as unknown as QuotationInput;
    if (!input) return null;
    return computeQuotation(input);
  } catch {
    return null;
  }
}

/**
 * Project a QuoteShareLink + its primary quotation into the customer-safe view.
 * Callers MUST have already enforced status=ACTIVE + expiry; `active` here only
 * reflects the projected status for the page's CTA gating.
 */
export function buildPublicQuoteView(
  link: ShareLinkForView,
  primaryQuotation: PrimaryQuotationForView | null
): PublicQuoteView {
  const result = resolveQuotationResult(primaryQuotation);

  const lines: PublicQuoteLine[] = (result?.lines ?? []).map((l) => ({
    sl: l.sl,
    particulars: l.particulars,
    plan: l.plan,
    amount: l.amount,
  }));

  const paymentSchedule: PublicQuoteInstallment[] = (result?.paymentSchedule ?? []).map((p) => ({
    label: p.label,
    pct: p.pct,
    amount: p.amount,
    dueHint: p.dueHint,
  }));

  // The 20% booking-advance is the first installment in the frozen schedule.
  const advanceAmount =
    paymentSchedule.length > 0 ? paymentSchedule[0].amount : null;

  const slotLabel = link.timeSlot
    ? SLOT_LABEL[plannerSlotToEnum(link.timeSlot)]
    : null;

  const now = Date.now();
  const expired =
    link.status === "EXPIRED" ||
    (!!link.expiresAt && link.expiresAt.getTime() < now);
  const active = link.status === "ACTIVE" && !expired;

  return {
    token: link.token,
    status: expired && link.status === "ACTIVE" ? "EXPIRED" : link.status,
    active,
    clientFirstName: firstNameOnly(link.clientName),
    occasion: link.occasion,
    eventDateISO: toUTCDateISO(link.eventDate),
    timeSlot: link.timeSlot,
    slotLabel,
    lines,
    subtotal: result?.subtotal ?? 0,
    discountPct: result?.discountPct ?? 0,
    discountAmount: result?.discountAmount ?? 0,
    taxRate: result?.taxRate ?? 0,
    tax: result?.tax ?? 0,
    grandTotal: result?.grandTotal ?? 0,
    paymentSchedule,
    currency: link.currency || "INR",
    payInvoiceId: link.payInvoiceId,
    paymentLinkUrl: link.paymentLinkUrl,
    advanceAmount,
    showSocialProof: !!link.showSocialProof,
  };
}
