"use server";

// ============================================================
// GST rates per property.
// ------------------------------------------------------------
// The property type sets which rate is preselected; these actions let someone
// see the rates, apply the standard pair for the type, switch which one is the
// default, and retire one that no longer applies. Retiring never deletes: a
// quotation raised under an old rate has to keep resolving to it.
// ============================================================

import { revalidatePath } from "next/cache";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { GST_PRESETS, presetTotal } from "@/lib/sales/property-type";
import { ensureVenueSlabs, getVenueSlabs, setDefaultSlab } from "@/lib/sales/venue-tax";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function gate(): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, "settings:venues")) return null;
  return { id: session.user.id };
}

export async function getVenueTaxRates(venueId: string) {
  const u = await gate();
  if (!u) return { success: false as const, error: "Not authorized." };
  try {
    const slabs = await getVenueSlabs(venueId);
    return {
      success: true as const,
      data: slabs.map((s) => ({
        id: s.id,
        name: s.name,
        total: s.cgstRate + s.sgstRate + s.igstRate,
        cgstRate: s.cgstRate,
        sgstRate: s.sgstRate,
        igstRate: s.igstRate,
        isDefault: s.isDefault,
        isActive: s.isActive,
      })),
    };
  } catch (e) {
    console.error("getVenueTaxRates error:", e);
    return { success: false as const, error: "Could not read the rates for this property." };
  }
}

/** Apply the standard pair for the property's type, overwriting those two. */
export async function applyStandardTaxRates(venueId: string): Promise<Result<{ created: number; updated: number }>> {
  const u = await gate();
  if (!u) return { success: false, error: "Not authorized." };
  try {
    const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { propertyType: true } });
    if (!venue) return { success: false, error: "Property not found." };
    const res = await ensureVenueSlabs(venueId, venue.propertyType, { reset: true });
    revalidatePath("/settings/venues");
    return { success: true, data: res };
  } catch (e) {
    console.error("applyStandardTaxRates error:", e);
    return { success: false, error: "Could not apply the standard rates." };
  }
}

export async function setVenueDefaultTaxRate(venueId: string, slabId: string): Promise<Result<null>> {
  const u = await gate();
  if (!u) return { success: false, error: "Not authorized." };
  try {
    await setDefaultSlab(venueId, slabId);
    revalidatePath("/settings/venues");
    return { success: true, data: null };
  } catch (e) {
    console.error("setVenueDefaultTaxRate error:", e);
    return { success: false, error: "Could not change the default rate." };
  }
}

/** Add one of the standard percentages to a property that needs a third rate. */
export async function addVenueTaxRate(venueId: string, presetName: string): Promise<Result<{ id: string }>> {
  const u = await gate();
  if (!u) return { success: false, error: "Not authorized." };
  const preset = GST_PRESETS.find((p) => p.name === presetName);
  if (!preset) return { success: false, error: "Unknown rate." };
  try {
    const existing = await prisma.venueTaxSlab.findFirst({ where: { venueId, name: preset.name } });
    if (existing) {
      // Re-offer a rate that was retired rather than refusing: same intent.
      await prisma.venueTaxSlab.update({ where: { id: existing.id }, data: { isActive: true } });
      revalidatePath("/settings/venues");
      return { success: true, data: { id: existing.id } };
    }
    const created = await prisma.venueTaxSlab.create({
      data: {
        venueId,
        name: preset.name,
        cgstRate: preset.cgstRate,
        sgstRate: preset.sgstRate,
        igstRate: preset.igstRate,
        isDefault: false,
        isActive: true,
      },
      select: { id: true },
    });
    revalidatePath("/settings/venues");
    return { success: true, data: created };
  } catch (e) {
    console.error("addVenueTaxRate error:", e);
    return { success: false, error: "Could not add that rate." };
  }
}

/** Stop offering a rate. It stays on quotations that already used it. */
export async function retireVenueTaxRate(slabId: string): Promise<Result<null>> {
  const u = await gate();
  if (!u) return { success: false, error: "Not authorized." };
  try {
    const slab = await prisma.venueTaxSlab.findUnique({ where: { id: slabId }, select: { venueId: true, isDefault: true } });
    if (!slab) return { success: false, error: "Rate not found." };
    if (slab.isDefault) {
      return { success: false, error: "That is the default rate. Make another rate the default first." };
    }
    await prisma.venueTaxSlab.update({ where: { id: slabId }, data: { isActive: false } });
    revalidatePath("/settings/venues");
    return { success: true, data: null };
  } catch (e) {
    console.error("retireVenueTaxRate error:", e);
    return { success: false, error: "Could not retire that rate." };
  }
}

/** The percentages an operator can add, for the picker. */
export async function listGstPresets() {
  return GST_PRESETS.map((p) => ({ name: p.name, total: presetTotal(p) }));
}
