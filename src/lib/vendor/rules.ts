// ============================================================
// Vendor Module — pure validation rules (R1–R6). No prisma / no auth, so this
// is unit-testable in isolation and is the single source of rule truth shared
// by the server actions. DB-dependent rules (R2 unique name, R3 category
// membership, R7/R8 cover, R10 soft-delete, R11 reorder) live in the actions.
// ============================================================

import { VENDOR_CATEGORIES } from "@/lib/constants";
import type { VendorCategory } from "@prisma/client";

export const CATEGORY_KEYS = new Set<string>(VENDOR_CATEGORIES.map((c) => c.key));
export const PRICE_UNITS = ["PER_PLATE", "PER_EVENT", "PER_PIECE", "PER_HOUR", "PER_DAY"];
export const ITEM_TYPES = ["FIXED", "SINGLE_CHOICE", "MULTI_CHOICE"];

// Vendor type + max-discount enums (kept here so the pure rules module is the
// single source of allowed string values shared by actions + UI).
export const VENDOR_TYPES = ["EXTERNAL", "PROPERTY_OWNER", "BILLION_EVENTS"];
export const MAX_DISCOUNT_TYPES = ["PERCENT", "AMOUNT"];

// Normalise a free-text category label into a stable lowercase-kebab key.
export function normalizeCategoryKey(raw: string): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Keep the legacy single `category` enum (used by bookings/payouts) in sync
// with the first selected catalog category.
export const LEGACY_CATEGORY: Record<string, VendorCategory> = {
  decor: "DECORATION",
  catering: "CATERING",
  emcee: "ENTERTAINMENT",
  photography: "PHOTOGRAPHY",
  av_lighting: "LIGHTING",
  entertainment: "ENTERTAINMENT",
};

export interface VendorCatalogInput {
  name: string;
  categories: string[];
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  empanelmentStatus?: string | null;
  keyPersonnel?: { name: string; role?: string }[];
  licences?: { type: string; number?: string; expiry?: string }[];
  notes?: string | null;
  // Vendor type + venue scope (assigned halls/venues)
  vendorType?: string | null; // EXTERNAL | PROPERTY_OWNER | BILLION_EVENTS
  venueIds?: string[]; // specific venue ids when allVenues is false
  allVenues?: boolean; // true ⇒ applies to all venues (overrides venueIds)
}

export interface PackageItemInput {
  name: string;
  type: string; // FIXED | SINGLE_CHOICE | MULTI_CHOICE
  options?: string[];
  chooseCount?: number | null;
  notes?: string | null;
}
export interface PackageSectionInput {
  title: string;
  items: PackageItemInput[];
}
export interface VendorPackageInput {
  vendorId: string;
  name: string;
  category: string;
  status?: string; // DRAFT | ACTIVE | ARCHIVED
  price: number;
  priceUnit: string;
  currency?: string;
  description?: string | null;
  sections: PackageSectionInput[];
  // Pricing extras
  vendorPrice?: number | null; // internal cost paid to the vendor
  customerPrice?: number | null; // customer-facing price (mirrors `price`)
  minPax?: number | null; // minimum pax / units
  maxDiscountType?: string | null; // PERCENT | AMOUNT
  maxDiscountValue?: number | null; // discount cap value
}

// Validate the pricing-extra fields for a package. Returns a fields error map.
export function validatePackagePricing(input: VendorPackageInput): Record<string, string> {
  const fields: Record<string, string> = {};
  if (input.vendorPrice != null && !(Number(input.vendorPrice) >= 0))
    fields.vendorPrice = "Vendor price must be ≥ 0";
  if (input.customerPrice != null && !(Number(input.customerPrice) >= 0))
    fields.customerPrice = "Customer price must be ≥ 0";
  if (input.minPax != null && !(Number(input.minPax) >= 0))
    fields.minPax = "Minimum pax must be ≥ 0";
  if (input.maxDiscountType != null && input.maxDiscountType !== "") {
    if (!MAX_DISCOUNT_TYPES.includes(input.maxDiscountType))
      fields.maxDiscount = "Invalid discount type";
    const v = Number(input.maxDiscountValue ?? 0);
    if (!(v >= 0)) fields.maxDiscount = "Discount value must be ≥ 0";
    else if (input.maxDiscountType === "PERCENT" && v > 100)
      fields.maxDiscount = "Percentage discount cannot exceed 100";
  }
  return fields;
}

// R1 (≥1 category) + name required + email + status. (R2 unique-name is DB-side.)
export function validateVendorFields(input: VendorCatalogInput): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!input.name?.trim()) fields.name = "Vendor name is required";
  // Categories are now dynamic (hardcoded seed + admin-defined). Any non-empty
  // key counts toward R1 — DB membership is validated in the action.
  const cats = (input.categories ?? []).map((c) => c?.trim()).filter(Boolean);
  if (cats.length < 1) fields.categories = "Select at least one category"; // R1
  if (input.email && input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    fields.email = "Enter a valid email";
  if (input.empanelmentStatus && !["empanelled", "probation", "suspended"].includes(input.empanelmentStatus))
    fields.empanelmentStatus = "Invalid status";
  if (input.vendorType && !VENDOR_TYPES.includes(input.vendorType))
    fields.vendorType = "Invalid vendor type";
  return fields;
}

// R4 — item options by type. Returns an error string or null if valid.
export function validateItem(it: PackageItemInput): string | null {
  if (!it.name?.trim()) return "Item name is required";
  if (!ITEM_TYPES.includes(it.type)) return `Invalid item type "${it.type}"`;
  const opts = (it.options ?? []).map((o) => o.trim()).filter(Boolean);
  if (it.type === "FIXED") return null; // options ignored for fixed
  if (it.type === "SINGLE_CHOICE") {
    if (opts.length < 1) return `"${it.name}" needs at least one option`;
    return null;
  }
  // MULTI_CHOICE
  const n = it.chooseCount ?? 0;
  if (n < 1) return `"${it.name}" must let the guest pick at least 1`;
  if (opts.length < n) return `"${it.name}" needs at least ${n} options to pick from`;
  return null;
}

// R5 (+R6 price≥0) — conditions to be ACTIVE; returns unmet conditions.
export function activationUnmet(input: VendorPackageInput): string[] {
  const unmet: string[] = [];
  if (!input.vendorId) unmet.push("needs a vendor");
  if (!input.name?.trim()) unmet.push("needs a name");
  if (!(Number(input.price) >= 0)) unmet.push("price must be ≥ 0"); // R6
  if (!PRICE_UNITS.includes(input.priceUnit)) unmet.push("needs a valid price unit");
  const sections = input.sections ?? [];
  const hasItem = sections.some((s) => (s.items ?? []).length > 0);
  if (!hasItem) unmet.push("needs at least one item");
  for (const s of sections) for (const it of s.items ?? []) {
    const e = validateItem(it);
    if (e) unmet.push(e);
  }
  return unmet;
}
