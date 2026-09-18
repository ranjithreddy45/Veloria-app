// ============================================================
// Customer-app package pricing — PURE (no IO), safe in client components.
// ------------------------------------------------------------
// Every rupee figure here comes out of the team's quotation engine
// (computeQuotation in lib/sales/quotation-calc.ts), the same function the
// Sales quote builder and the stored quotation run, so a customer's estimate
// can't disagree with the quote the team raises. This module only decides the
// engine's INPUT, using the quote builder's own rules:
//
//   - Partner packages price per VendorPackage.priceUnit, labelled with the
//     team's words (VENDOR_PACKAGE_PRICE_UNIT_LABELS). PER_PLATE is charged per
//     guest, PER_EVENT is flat, PER_PIECE / PER_HOUR / PER_DAY are per unit.
//   - The builder defaults a line's quantity to the guest count for PER_PLATE
//     and to the package minimum (or 1) otherwise, and refuses a quote below
//     the package minimum — so an estimate never goes below it either.
//   - Veloria catering is QUOTE_CATALOG.food, charged per plate; a quote holds
//     one food package at a time.
//
// Estimates are pre-tax: the headline figure is the engine's subtotal.
// ============================================================

import { computeQuotation, QUOTE_CATALOG, type PackageLine } from "@/lib/sales/quotation-calc";
import { VENDOR_PACKAGE_PRICE_UNIT_LABELS } from "@/lib/constants";
import { inr } from "../../../_components/format";
import type { PublicCateringPackage } from "./package-catalog";

export type PriceBasis = "PER_GUEST" | "FLAT" | "PER_UNIT";

/** How a price unit scales: per guest (per plate), flat (per event), or per unit. */
export function priceBasis(priceUnit: string): PriceBasis {
  if (priceUnit === "PER_PLATE") return "PER_GUEST";
  if (priceUnit === "PER_EVENT") return "FLAT";
  return "PER_UNIT";
}

/** The team's own label for a price unit ("per plate", "per event", …). */
export function priceUnitLabel(priceUnit: string): string {
  return VENDOR_PACKAGE_PRICE_UNIT_LABELS[priceUnit] ?? priceUnit.toLowerCase().replace(/_/g, " ");
}

const UNIT_NOUNS: Record<string, readonly [string, string]> = {
  PER_PLATE: ["plate", "plates"],
  PER_EVENT: ["event", "events"],
  PER_PIECE: ["piece", "pieces"],
  PER_HOUR: ["hour", "hours"],
  PER_DAY: ["day", "days"],
};

/** "120 plates", "1 event", "4 hours". */
export function quantityLabel(priceUnit: string, qty: number): string {
  const [one, many] = UNIT_NOUNS[priceUnit] ?? ["unit", "units"];
  return `${qty.toLocaleString("en-IN")} ${qty === 1 ? one : many}`;
}

export type QuantityBasis = "GUESTS" | "MINIMUM" | "ONE";

/**
 * The quantity the team would quote: the quote builder's default (guest count
 * for PER_PLATE, else the package minimum, else 1), never below the minimum.
 */
export function estimateQuantity(pkg: { priceUnit: string; minPax: number | null }, guests: number): { qty: number; basis: QuantityBasis } {
  const pax = Number.isFinite(guests) ? Math.floor(guests) : 0;
  const min = pkg.minPax != null && pkg.minPax > 0 ? Math.floor(pkg.minPax) : 0;
  if (pkg.priceUnit === "PER_PLATE" && pax >= 1) {
    return pax >= min ? { qty: pax, basis: "GUESTS" } : { qty: min, basis: "MINIMUM" };
  }
  return min > 0 ? { qty: min, basis: "MINIMUM" } : { qty: 1, basis: "ONE" };
}

export interface PricedPackage {
  id: string;
  name: string;
  categoryLabel: string;
  unitPrice: number;
  priceUnit: string;
  minPax: number | null;
}

/** The quote-builder package line this package becomes for a guest count. */
export function packageLine(pkg: PricedPackage, guests: number): PackageLine {
  const { qty } = estimateQuantity(pkg, guests);
  return {
    vendorPackageId: pkg.id,
    name: pkg.name,
    category: pkg.categoryLabel,
    unitPrice: pkg.unitPrice,
    qty,
    minPax: pkg.minPax ?? undefined,
  };
}

export interface EstimateLine {
  key: string;
  label: string;
  qty: number;
  qtyLabel: string;
  basis: QuantityBasis;
  /** Engine subtotal for this line alone, before taxes. */
  amount: number;
}

export interface SelectionEstimate {
  guests: number;
  lines: EstimateLine[];
  /** Engine subtotal for the whole selection, before taxes. */
  subtotal: number;
}

function wholeGuests(guests: number): number | null {
  const n = Math.floor(guests);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** Veloria's per-plate catering packages, straight from the quote catalog. */
export function cateringCatalog(): PublicCateringPackage[] {
  return QUOTE_CATALOG.food.map((f) => ({ id: f.id, label: f.label, perPlate: f.perPlate, veg: f.veg }));
}

/** Estimate for one partner package. Null until a guest count of at least 1 is known. */
export function estimatePackage(pkg: PricedPackage, guests: number): EstimateLine | null {
  const n = wholeGuests(guests);
  if (n == null) return null;
  const line = packageLine(pkg, n);
  const { basis } = estimateQuantity(pkg, n);
  const result = computeQuotation({ guestCount: n, packageLines: [line] });
  return { key: pkg.id, label: pkg.name, qty: line.qty, qtyLabel: quantityLabel(pkg.priceUnit, line.qty), basis, amount: result.subtotal };
}

/** Estimate for one Veloria catering package (per plate × guests). */
export function estimateCatering(foodPackageId: string, guests: number): EstimateLine | null {
  const n = wholeGuests(guests);
  const food = QUOTE_CATALOG.food.find((f) => f.id === foodPackageId);
  if (n == null || !food) return null;
  const result = computeQuotation({ guestCount: n, foodPackageId: food.id });
  return { key: food.id, label: food.label, qty: n, qtyLabel: quantityLabel("PER_PLATE", n), basis: "GUESTS", amount: result.subtotal };
}

/** Estimate for a whole selection: one engine run, the same way a quote would add it up. */
export function estimateSelection(sel: { guests: number; cateringId: string | null; packages: readonly PricedPackage[] }): SelectionEstimate | null {
  const n = wholeGuests(sel.guests);
  if (n == null) return null;
  const food = sel.cateringId ? QUOTE_CATALOG.food.find((f) => f.id === sel.cateringId) : undefined;
  if (!food && sel.packages.length === 0) return null;
  const lines: EstimateLine[] = [];
  if (food) {
    const l = estimateCatering(food.id, n);
    if (l) lines.push(l);
  }
  for (const p of sel.packages) {
    const l = estimatePackage(p, n);
    if (l) lines.push(l);
  }
  const total = computeQuotation({
    guestCount: n,
    foodPackageId: food?.id,
    packageLines: sel.packages.map((p) => packageLine(p, n)),
  });
  return { guests: n, lines, subtotal: total.subtotal };
}

/** Longest text requestFromConcierge keeps. */
export const REQUEST_TEXT_MAX = 1000;

/**
 * The message a signed-in host sends with "Request for my booking". Prices are
 * quoted with their real unit, and an estimate (when shown) states its guest
 * count and that it is before taxes, so the team reads exactly what the host saw.
 */
export function packageRequestText(sel: {
  catering: PublicCateringPackage | null;
  packages: readonly (PricedPackage & { vendorName: string })[];
  estimate: SelectionEstimate | null;
}): string {
  const lines: string[] = [];
  if (sel.catering) lines.push(`• ${sel.catering.label} (Veloria catering, ${inr(sel.catering.perPlate)} per plate)`);
  for (const p of sel.packages) {
    const min = p.minPax && p.minPax > 1 ? `, minimum ${quantityLabel(p.priceUnit, p.minPax)}` : "";
    lines.push(`• ${p.name} (${p.vendorName}, ${inr(p.unitPrice)} ${priceUnitLabel(p.priceUnit)}${min})`);
  }
  const head = "Please add to my booking:";
  const foot = sel.estimate
    ? `App estimate for ${sel.estimate.guests.toLocaleString("en-IN")} guests: ${inr(sel.estimate.subtotal)} before taxes. Please confirm the final price on my quotation.`
    : "Please confirm prices for my guest count on my quotation.";
  const kept: string[] = [];
  let used = head.length + foot.length + 2;
  for (let i = 0; i < lines.length; i++) {
    const rest = lines.length - i - 1;
    const more = rest > 0 ? `\n• …and ${rest} more` : "";
    if (used + lines[i].length + 1 + more.length > REQUEST_TEXT_MAX) {
      kept.push(`• …and ${lines.length - i} more`);
      break;
    }
    kept.push(lines[i]);
    used += lines[i].length + 1;
  }
  return [head, ...kept, foot].join("\n");
}
