// ============================================================
// Public quote-page view types — PUBLIC-safe projection shape.
// ------------------------------------------------------------
// The customer-safe shape the /q/[token] page + its components render. The
// backend agent's getPublicQuoteForPay(token) resolves a QuoteShareLink by
// token and returns ONLY these fields (projected through build-public-view).
// This module carries NO internal field (no leadId, rep identity, cost/margin,
// internal notes) — it is the single typed contract between the public page and
// the public action, so a component can never accidentally render internal data.
//
// These mirror the frozen SalesQuotation.outputsJson (QuotationResult) line/
// total shape but flattened to plain serializable values.
// ============================================================

/** One line item of a quote breakdown (from frozen outputsJson). */
export interface PublicQuoteLine {
  sl: number;
  particulars: string;
  plan: string;
  amount: number;
}

/** One installment of the 20/60/20 payment schedule. */
export interface PublicPaymentInstallment {
  label: string;
  pct: number;
  amount: number;
  dueHint: string;
}

/** A single Good-Better-Best tier rendered side-by-side on the page. */
export interface PublicQuoteTier {
  /** QuoteTier.id — opaque, safe to expose for selection. */
  id: string;
  /** Plain ref → the priced SalesQuotation.id this tier pays from. */
  quotationId: string;
  displayName: string; // "Silver" | "Gold" | "Platinum" | custom
  order: number;
  grandTotal: number;
  /** First (20%) booking-advance installment for this tier, paise-exact. */
  advanceAmount: number;
  isRecommended: boolean;
  isSelected: boolean;
  lines: PublicQuoteLine[];
  subtotal: number;
  discountAmount: number;
  tax: number;
  paymentSchedule: PublicPaymentInstallment[];
}

/** Live per-slot availability for the link's venue+date (no booking identities). */
export interface PublicSlotChip {
  slot: string; // enum key, e.g. "MORNING"
  slotLabel: string; // human label, e.g. "Morning"
  free: boolean;
}

export interface PublicSlotScarcity {
  chips: PublicSlotChip[];
  /** Headline urgency copy, e.g. "Only Evening left for this date". */
  message: string | null;
  /** True when the quote's own slot is still free. */
  selectedSlotFree: boolean;
}

/**
 * The full customer-safe quote payload for /q/[token].
 * Single-tier links carry one entry in `tiers`; Good-Better-Best links carry 2-3.
 */
export interface PublicQuoteView {
  /** QuoteShareLink.token — echoed for client actions (start/confirm pay). */
  token: string;
  clientFirstName: string;
  occasion: string | null;
  /** ISO date string of the event, or null. */
  eventDate: string | null;
  slotLabel: string | null;
  currency: string;
  /** Default/highlighted tier's grand total (headline). */
  grandTotal: number;
  tiers: PublicQuoteTier[];
  /** Show the approved-reviews / gallery strip inline. */
  showSocialProof: boolean;
  /** True once an advance has cleared and the date is secured. */
  paid: boolean;
  /** True when the underlying slot has been blocked/booked. */
  blocked: boolean;
  /** For event-type/venue-matched social proof. */
  eventType: string | null;
  venueId: string | null;
}
