// ============================================================
// Public configurator catalog projection — PUBLIC-safe.
// ------------------------------------------------------------
// The public self-serve configurator must price "to the rupee" against the
// SAME engine the internal calculator uses. To guarantee prices can never
// diverge, this module DERIVES its option lists from the single QUOTE_CATALOG
// export in lib/sales/quotation-calc.ts — it never hand-copies a price.
//
// It exposes a slimmed, serializable shape (ids + labels + prices only) so the
// public page never has to import internal-only modules, plus a thin venue
// wrapper around the existing public getStorefrontVenues().
// ============================================================

import {
  QUOTE_CATALOG,
  QUOTE_TAX_RATE,
  DEFAULT_ROOM_CHARGE,
  MIN_HALL_HOURS,
} from "@/lib/sales/quotation-calc";
import { getStorefrontVenues, type StorefrontVenue } from "@/actions/storefront.actions";

// ---- Public-safe catalog shape (plain serializable values) ----

export interface PublicFoodOption {
  id: string;
  label: string;
  perPlate: number;
  veg: boolean;
}
export interface PublicFixedOption {
  id: string;
  label: string;
  amount: number;
}
export interface PublicCakeOption {
  id: string;
  label: string;
  ratePerKg: number;
}
export interface PublicPhotoOption {
  id: string;
  label: string;
  amount: number | null; // null = "Other (custom)" — customer types an amount
}

export interface PublicConfiguratorCatalog {
  timeSlots: string[];
  hallRates: number[];
  food: PublicFoodOption[];
  decor: PublicFixedOption[];
  activity: PublicFixedOption[];
  cake: PublicCakeOption[];
  photography: PublicPhotoOption[];
  taxRate: number; // 0.05
  defaultRoomCharge: number;
  minHallHours: number;
}

/**
 * Projection of the SINGLE QUOTE_CATALOG into a public-safe, fully serializable
 * shape. Pure (no IO). Built freshly from QUOTE_CATALOG so it can never drift
 * from the pricing engine.
 */
export function getPublicConfiguratorCatalog(): PublicConfiguratorCatalog {
  return {
    timeSlots: [...QUOTE_CATALOG.timeSlots],
    hallRates: [...QUOTE_CATALOG.hallRates],
    food: QUOTE_CATALOG.food.map((f) => ({
      id: f.id,
      label: f.label,
      perPlate: f.perPlate,
      veg: f.veg,
    })),
    decor: QUOTE_CATALOG.decor.map((d) => ({ id: d.id, label: d.label, amount: d.amount })),
    activity: QUOTE_CATALOG.activity.map((a) => ({ id: a.id, label: a.label, amount: a.amount })),
    cake: QUOTE_CATALOG.cake.map((c) => ({ id: c.id, label: c.label, ratePerKg: c.ratePerKg })),
    photography: QUOTE_CATALOG.photography.map((p) => ({
      id: p.id,
      label: p.label,
      amount: p.amount,
    })),
    taxRate: QUOTE_TAX_RATE,
    defaultRoomCharge: DEFAULT_ROOM_CHARGE,
    minHallHours: MIN_HALL_HOURS,
  };
}

/**
 * Thin public wrapper around the existing storefront venue list so the public
 * configurator page does not have to import internal venue actions. Returns the
 * same public-safe venue projection the storefront already exposes.
 */
export async function getPublicVenuesForConfigurator(): Promise<StorefrontVenue[]> {
  return getStorefrontVenues();
}
