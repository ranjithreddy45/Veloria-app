// ============================================================
// The GST rates a property offers, and how they get there.
// ------------------------------------------------------------
// VenueTaxSlab and the resolver in tax-slab.ts were written and then never
// wired to anything: no property had a single rate configured, so every
// quotation and invoice fell back to whatever the person typing chose. This is
// the database half that makes the property type mean something.
//
// Rates are never rewritten silently. A property that already has rates keeps
// them when its type changes, because someone may have set them deliberately;
// changing them is an explicit action with its own button.
// ============================================================

import { prisma } from "@/lib/prisma";

import { defaultSlabsFor } from "./property-type";
import type { TaxSlabLike } from "./tax-slab";

export interface VenueSlabRow extends TaxSlabLike {
  venueId: string;
}

const toRow = (s: {
  id: string;
  venueId: string;
  name: string;
  cgstRate: unknown;
  sgstRate: unknown;
  igstRate: unknown;
  isDefault: boolean;
  isActive: boolean;
}): VenueSlabRow => ({
  id: s.id,
  venueId: s.venueId,
  name: s.name,
  cgstRate: Number(s.cgstRate),
  sgstRate: Number(s.sgstRate),
  igstRate: Number(s.igstRate),
  isDefault: s.isDefault,
  isActive: s.isActive,
});

/** Every rate on a property, newest rules last. Inactive ones included: a quote
 *  raised under a retired rate must still resolve to it. */
export async function getVenueSlabs(venueId: string): Promise<VenueSlabRow[]> {
  const rows = await prisma.venueTaxSlab.findMany({
    where: { venueId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map(toRow);
}

/**
 * Give a property the standard rates for its type.
 *
 * `reset: false` (the default) only fills a property that has none, so calling
 * it on save can never overwrite a rate someone set by hand. `reset: true` is
 * the explicit "use the standard rates" button: it rewrites the two standard
 * rates and re-points the default, but leaves any extra rate the property has
 * alone and never deletes one, because a historical quotation may point at it.
 */
export async function ensureVenueSlabs(
  venueId: string,
  propertyType: string | null | undefined,
  opts: { reset?: boolean } = {}
): Promise<{ created: number; updated: number }> {
  const existing = await prisma.venueTaxSlab.findMany({ where: { venueId } });
  if (existing.length > 0 && !opts.reset) return { created: 0, updated: 0 };

  const wanted = defaultSlabsFor(propertyType);
  let created = 0;
  let updated = 0;

  for (const slab of wanted) {
    const match = existing.find((e) => e.name === slab.name);
    if (!match) {
      await prisma.venueTaxSlab.create({
        data: {
          venueId,
          name: slab.name,
          cgstRate: slab.cgstRate,
          sgstRate: slab.sgstRate,
          igstRate: slab.igstRate,
          isDefault: slab.isDefault,
          isActive: true,
        },
      });
      created++;
    } else if (opts.reset) {
      await prisma.venueTaxSlab.update({
        where: { id: match.id },
        data: {
          cgstRate: slab.cgstRate,
          sgstRate: slab.sgstRate,
          igstRate: slab.igstRate,
          isDefault: slab.isDefault,
          isActive: true,
        },
      });
      updated++;
    }
  }

  // Exactly one default, or the resolver asks every time. Any other rate the
  // property carries loses its default flag when the standard ones are applied.
  if (opts.reset) {
    const names = wanted.map((w) => w.name);
    await prisma.venueTaxSlab.updateMany({
      where: { venueId, name: { notIn: names }, isDefault: true },
      data: { isDefault: false },
    });
  }

  return { created, updated };
}

/** Make exactly one rate the default for a property. */
export async function setDefaultSlab(venueId: string, slabId: string): Promise<void> {
  await prisma.$transaction([
    prisma.venueTaxSlab.updateMany({ where: { venueId }, data: { isDefault: false } }),
    prisma.venueTaxSlab.update({ where: { id: slabId }, data: { isDefault: true, isActive: true } }),
  ]);
}
