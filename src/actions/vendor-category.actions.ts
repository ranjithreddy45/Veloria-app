"use server";

// ============================================================
// Vendor Module — dynamic category actions
// ------------------------------------------------------------
// Categories are stable string keys. There is a hardcoded seed
// (VENDOR_CATEGORIES in constants) PLUS super-admin-defined rows in the
// VendorCategoryDef table. listVendorCategories() merges the two for pickers;
// create/update are gated by `vendor-categories:manage` (ADMIN + SUPER_ADMIN).
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { VENDOR_CATEGORIES } from "@/lib/constants";
import { normalizeCategoryKey } from "@/lib/vendor/rules";

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: string; fields?: Record<string, string> };
type Result<T> = Ok<T> | Err;

export interface VendorCategoryOption {
  key: string;
  label: string;
  source: "seed" | "custom";
}

export interface VendorCategoryDefRow {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

async function requireSession(): Promise<{ id: string; role: string } | null> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const id = session?.user?.id;
  if (!id || !role) return null;
  return { id, role };
}

async function requireManage(): Promise<{ id: string; role: string } | null> {
  const u = await requireSession();
  if (!u || !hasPermission(u.role, "vendor-categories:manage")) return null;
  return u;
}

// ------------------------------------------------------------
// Read — merged list for pickers (seed + ACTIVE custom rows), deduped + sorted
// ------------------------------------------------------------
export async function listVendorCategories(): Promise<Result<VendorCategoryOption[]>> {
  const u = await requireSession();
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const defs = await prisma.vendorCategoryDef.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { key: true, label: true },
    });

    const byKey = new Map<string, VendorCategoryOption>();
    // Seed first (stable order), then custom rows override/append.
    for (const c of VENDOR_CATEGORIES) {
      byKey.set(c.key, { key: c.key, label: c.label, source: "seed" });
    }
    for (const d of defs) {
      byKey.set(d.key, { key: d.key, label: d.label, source: "custom" });
    }

    const merged = Array.from(byKey.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
    return { success: true, data: merged };
  } catch (e) {
    console.error("[LIST_VENDOR_CATEGORIES]", e);
    return { success: false, error: "Failed to load categories" };
  }
}

// ------------------------------------------------------------
// Read — all custom defs (for the admin management UI). Gated by manage perm.
// ------------------------------------------------------------
export async function listVendorCategoryDefs(): Promise<Result<VendorCategoryDefRow[]>> {
  const u = await requireManage();
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const defs = await prisma.vendorCategoryDef.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, key: true, label: true, isActive: true, sortOrder: true },
    });
    return { success: true, data: serialize(defs) };
  } catch (e) {
    console.error("[LIST_VENDOR_CATEGORY_DEFS]", e);
    return { success: false, error: "Failed to load categories" };
  }
}

// ------------------------------------------------------------
// Create
// ------------------------------------------------------------
export async function createVendorCategory(input: {
  key?: string;
  label: string;
}): Promise<Result<{ id: string; key: string }>> {
  const u = await requireManage();
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const label = input.label?.trim();
    if (!label) return { success: false, error: "Validation failed", fields: { label: "Label is required" } };

    // Key derives from the provided key or the label; always normalised.
    const key = normalizeCategoryKey(input.key?.trim() || label);
    if (!key) return { success: false, error: "Validation failed", fields: { key: "Enter a valid key" } };

    // Guard duplicates against BOTH the hardcoded seed and existing custom rows.
    if (VENDOR_CATEGORIES.some((c) => c.key === key))
      return { success: false, error: "Validation failed", fields: { key: "This category already exists" } };
    const dupe = await prisma.vendorCategoryDef.findUnique({ where: { key }, select: { id: true } });
    if (dupe) return { success: false, error: "Validation failed", fields: { key: "This category already exists" } };

    const maxOrder = await prisma.vendorCategoryDef.aggregate({ _max: { sortOrder: true } });
    const created = await prisma.vendorCategoryDef.create({
      data: {
        key,
        label,
        isActive: true,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        createdById: u.id,
      },
      select: { id: true, key: true },
    });
    revalidatePath("/vendors");
    return { success: true, data: created };
  } catch (e) {
    console.error("[CREATE_VENDOR_CATEGORY]", e);
    return { success: false, error: "Failed to create category" };
  }
}

// ------------------------------------------------------------
// Update (label / isActive / sortOrder). Key is immutable once created.
// ------------------------------------------------------------
export async function updateVendorCategory(
  id: string,
  patch: { label?: string; isActive?: boolean; sortOrder?: number }
): Promise<Result<{ id: string }>> {
  const u = await requireManage();
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const existing = await prisma.vendorCategoryDef.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return { success: false, error: "Category not found" };

    const data: { label?: string; isActive?: boolean; sortOrder?: number } = {};
    if (patch.label !== undefined) {
      const label = patch.label.trim();
      if (!label) return { success: false, error: "Validation failed", fields: { label: "Label is required" } };
      data.label = label;
    }
    if (patch.isActive !== undefined) data.isActive = patch.isActive;
    if (patch.sortOrder !== undefined && Number.isFinite(patch.sortOrder))
      data.sortOrder = Math.trunc(patch.sortOrder);

    await prisma.vendorCategoryDef.update({ where: { id }, data });
    revalidatePath("/vendors");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[UPDATE_VENDOR_CATEGORY]", e);
    return { success: false, error: "Failed to update category" };
  }
}
