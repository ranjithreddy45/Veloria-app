// ============================================================
// Quote Tiers (Good-Better-Best) — pure helpers.
// ------------------------------------------------------------
// No IO, no "use server". Shared by the rep builder actions, the public share
// action, and the public page. Owns: token minting, the Silver/Gold/Platinum
// presets, the per-tier comparison view model, the customer-safe field strip,
// and the WhatsApp share caption. All money arrives already-numeric (Decimals
// are serialized at the action boundary); formatting is INR.
// ============================================================

import { randomBytes } from "crypto";
import type { QuoteTierLabel } from "@prisma/client";
import { buildPaymentSchedule, type QuotationResult, type QuoteLine } from "@/lib/sales/quotation-calc";

/** Unguessable share token (same convention as quote-radar/token). */
export function genQuoteToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface TierPreset {
  label: QuoteTierLabel;
  displayName: string;
  order: number;
  isRecommended: boolean;
}

/**
 * Default Good-Better-Best presets. Gold is the recommended (anchor) tier,
 * presented between a cheaper Silver and a pricier Platinum to anchor deal size.
 * isRecommended is presentational ONLY — it never feeds back into pricing.
 */
export const TIER_PRESETS: Record<"SILVER" | "GOLD" | "PLATINUM", TierPreset> = {
  SILVER: { label: "SILVER", displayName: "Silver", order: 0, isRecommended: false },
  GOLD: { label: "GOLD", displayName: "Gold", order: 1, isRecommended: true },
  PLATINUM: { label: "PLATINUM", displayName: "Platinum", order: 2, isRecommended: false },
};

export const TIER_PRESET_ORDER: ("SILVER" | "GOLD" | "PLATINUM")[] = [
  "SILVER",
  "GOLD",
  "PLATINUM",
];

/** INR formatter for captions/labels (no currency symbol drift). */
export function fmtINR(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₹0";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** A single customer-safe tier line. */
export interface PublicTierLine {
  sl: number;
  particulars: string;
  plan: string;
  amount: number;
}

/** A normalised, customer-safe view of one tier for the public page. */
export interface TierComparisonRow {
  quotationId: string;
  label: QuoteTierLabel;
  displayName: string;
  order: number;
  isRecommended: boolean;
  isSelected: boolean;
  lines: PublicTierLine[];
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  taxRate: number;
  tax: number;
  grandTotal: number;
  /** 20% booking-advance "pay now" figure, from the frozen schedule. */
  payNowAmount: number;
}

/**
 * Strip a frozen QuotationResult down to the customer-facing fields only.
 * Defends the public page against any internal data ever riding along on the
 * outputsJson blob (it shouldn't, but this is the chokepoint).
 */
export function pickPublicQuoteFields(out: QuotationResult | null | undefined): {
  lines: PublicTierLine[];
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  taxRate: number;
  tax: number;
  grandTotal: number;
  payNowAmount: number;
} {
  const lines: PublicTierLine[] = (out?.lines ?? []).map((l: QuoteLine) => ({
    sl: l.sl,
    particulars: l.particulars,
    plan: l.plan,
    amount: l.amount,
  }));
  const grandTotal = out?.grandTotal ?? 0;
  // Prefer the frozen schedule's first installment; else derive 20% deterministically.
  const schedule = out?.paymentSchedule ?? buildPaymentSchedule(grandTotal);
  const payNowAmount = schedule.length > 0 ? schedule[0].amount : Math.round(grandTotal * 0.2);
  return {
    lines,
    subtotal: out?.subtotal ?? 0,
    discountPct: out?.discountPct ?? 0,
    discountAmount: out?.discountAmount ?? 0,
    taxRate: out?.taxRate ?? 0,
    tax: out?.tax ?? 0,
    grandTotal,
    payNowAmount,
  };
}

/** A tier + its (already-resolved) frozen outputsJson, ready to project. */
export interface TierWithOutputs {
  quotationId: string;
  label: QuoteTierLabel;
  displayName: string;
  order: number;
  isRecommended: boolean;
  isSelected: boolean;
  outputs: QuotationResult | null;
}

/**
 * Build the per-tier comparison view model for the public side-by-side page.
 * Sorted by `order` (Silver → Gold → Platinum). Pure projection — no recompute
 * of price beyond reading the frozen snapshot.
 */
export function buildTierComparison(tiers: TierWithOutputs[]): TierComparisonRow[] {
  return [...tiers]
    .sort((a, b) => a.order - b.order)
    .map((t) => {
      const safe = pickPublicQuoteFields(t.outputs);
      return {
        quotationId: t.quotationId,
        label: t.label,
        displayName: t.displayName,
        order: t.order,
        isRecommended: t.isRecommended,
        isSelected: t.isSelected,
        ...safe,
      };
    });
}

/** Headline fields needed to build a share caption (no PII beyond first name). */
export interface TierShareCaptionInput {
  clientName?: string | null;
  occasion?: string | null;
  eventDate?: Date | string | null;
  url: string;
}

function firstName(name?: string | null): string {
  const n = (name ?? "").trim();
  return n ? n.split(/\s+/)[0] : "there";
}

function dateLabel(d?: Date | string | null): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return null;
  // UTC components to match @db.Date storage.
  return dt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Deterministic WhatsApp/text caption advertising the side-by-side tiers link.
 * The recommended tier's price anchors the message. Never includes internal data.
 */
export function buildTierShareCaption(
  input: TierShareCaptionInput,
  tiers: TierComparisonRow[]
): string {
  const name = firstName(input.clientName);
  const occasion = (input.occasion ?? "").trim() || "your event";
  const when = dateLabel(input.eventDate);
  const recommended = tiers.find((t) => t.isRecommended) ?? tiers[0];
  const tierNames = tiers.map((t) => t.displayName).join(" · ");

  const lines: string[] = [];
  lines.push(`Hi ${name}! Here are your ${occasion} packages${when ? ` for ${when}` : ""}.`);
  if (tierNames) lines.push(`Choose from: ${tierNames}.`);
  if (recommended) {
    lines.push(
      `Our recommended ${recommended.displayName} package: ${fmtINR(recommended.grandTotal)} (just ${fmtINR(recommended.payNowAmount)} to block your date).`
    );
  }
  lines.push(`View & pick yours: ${input.url}`);
  return lines.join("\n");
}

/** Resolve a free-form label/displayName to a QuoteTierLabel enum value. */
export function resolveTierLabel(value?: string | null): QuoteTierLabel {
  const v = (value ?? "").trim().toUpperCase();
  if (v === "SILVER" || v === "GOLD" || v === "PLATINUM") return v as QuoteTierLabel;
  return "CUSTOM";
}
