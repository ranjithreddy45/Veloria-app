// ============================================================
// Curated self-serve packages — PUBLIC-safe.
// ------------------------------------------------------------
// The public /configure flow used to expose the internal rate card directly
// (customers picked a raw "hall rate per hour", typed custom photography
// amounts, and saw internal decor SKUs like "LED back screen 12/8"). That leaks
// staff pricing internals and overwhelms a first-time customer.
//
// Instead we present three ready-made packages (Silver / Gold / Platinum) that
// bundle sensible inclusions. Each package is DERIVED from the same public
// catalog projection (which itself derives from the single QUOTE_CATALOG), so a
// package can never reference a price that isn't real, and the live total is
// still produced by the SAME computeQuotation() engine — the customer just
// doesn't assemble it line by line.
//
// A package resolves to a partial set of configurator fields (a "preset"). Only
// ids that actually exist in the catalog are used; a missing id is simply
// dropped, so the packages degrade gracefully if the catalog changes.
// ============================================================

import type { PublicConfiguratorCatalog } from "@/lib/public/configurator-catalog";

export type CuratedPackageKey = "silver" | "gold" | "platinum";

/** The subset of configurator state a package pre-fills. Always WITH_FOOD — the
 *  hall-only path is a "talk to our team" conversation, not self-serve. */
export interface CuratedPackagePreset {
  foodPackageId?: string;
  decorId?: string;
  activityIds: string[];
  photographyId?: string;
  cakeId?: string;
  cakeKg?: number;
}

export interface CuratedPackage {
  key: CuratedPackageKey;
  name: string;
  tagline: string;
  /** Optional ribbon, e.g. "Most booked". */
  badge?: string;
  /** Human-readable inclusions shown on the card (built from real catalog items). */
  highlights: string[];
  preset: CuratedPackagePreset;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Recipe = the catalog ids each tier bundles. Kept declarative so the mapping
 *  is obvious and easy to retune without touching the build logic. */
interface Recipe {
  key: CuratedPackageKey;
  name: string;
  tagline: string;
  badge?: string;
  foodId: string;
  decorId: string;
  activityIds: string[];
  photographyId?: string;
  cakeId?: string;
  cakeKg?: number;
}

const RECIPES: Recipe[] = [
  {
    key: "silver",
    name: "Silver",
    tagline: "A warm, complete celebration — everything the essentials need.",
    foodId: "veg_silver",
    decorId: "bday_single",
    activityIds: ["balloon"],
  },
  {
    key: "gold",
    name: "Gold",
    tagline: "Our most-booked package — the sweet spot of value and wow.",
    badge: "Most booked",
    foodId: "veg_gold",
    decorId: "bday_double",
    activityIds: ["balloon", "caricature"],
    photographyId: "bday",
    cakeId: "basic",
    cakeKg: 2,
  },
  {
    key: "platinum",
    name: "Platinum",
    tagline: "The full luxury experience — premium everything, nothing to add.",
    foodId: "veg_platinum",
    decorId: "led_10_20",
    activityIds: ["balloon", "keychain", "caricature"],
    photographyId: "bday",
    cakeId: "premium",
    cakeKg: 3,
  },
];

/**
 * Build the three curated packages from the public catalog. Pure. Any recipe id
 * that isn't found in the catalog is silently skipped (the package still works,
 * it just doesn't include that item), so this never throws on catalog drift.
 */
export function buildCuratedPackages(catalog: PublicConfiguratorCatalog): CuratedPackage[] {
  return RECIPES.map((r) => {
    const food = catalog.food.find((f) => f.id === r.foodId);
    const decor = catalog.decor.find((d) => d.id === r.decorId);
    const activities = r.activityIds
      .map((id) => catalog.activity.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => !!a);
    const photo = r.photographyId
      ? catalog.photography.find((p) => p.id === r.photographyId && p.amount != null)
      : undefined;
    const cake = r.cakeId ? catalog.cake.find((c) => c.id === r.cakeId) : undefined;

    const highlights: string[] = [];
    if (food) highlights.push(`${food.label} catering (${inr(food.perPlate)}/plate)`);
    if (decor) highlights.push(`${decor.label} décor`);
    if (activities.length) highlights.push(activities.map((a) => a.label).join(" + "));
    if (photo) highlights.push(`${photo.label} photography`);
    if (cake && r.cakeKg) highlights.push(`${r.cakeKg}kg ${cake.label.toLowerCase()} cake`);

    return {
      key: r.key,
      name: r.name,
      tagline: r.tagline,
      badge: r.badge,
      highlights,
      preset: {
        foodPackageId: food?.id,
        decorId: decor?.id,
        activityIds: activities.map((a) => a.id),
        photographyId: photo?.id,
        cakeId: cake?.id,
        cakeKg: cake ? r.cakeKg : undefined,
      },
    };
  });
}

/** Infer which package a resumed draft matches (by food package), else null. */
export function inferPackageKey(
  packages: CuratedPackage[],
  foodPackageId: string | undefined,
): CuratedPackageKey | null {
  if (!foodPackageId) return null;
  return packages.find((p) => p.preset.foodPackageId === foodPackageId)?.key ?? null;
}
