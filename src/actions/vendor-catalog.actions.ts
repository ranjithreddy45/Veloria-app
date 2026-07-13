"use server";

// ============================================================
// Vendor Module — catalog actions (vendors + structured packages)
// ------------------------------------------------------------
// Operates on the SAME Vendor rows as the operational vendor flow, using the
// additive catalog fields (categories[], keyPersonnel, licences, qualityScore,
// empanelmentStatus, isArchived) + the VendorPackage→Section→Item→Image graph.
// Every rule R1–R13 from the spec is enforced HERE (server is source of truth).
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import {
  CATEGORY_KEYS,
  PRICE_UNITS,
  VENDOR_TYPES,
  LEGACY_CATEGORY,
  validateItem,
  activationUnmet,
  validateVendorFields,
  validatePackagePricing,
  type VendorCatalogInput,
  type VendorPackageInput,
  type PackageSectionInput,
} from "@/lib/vendor/rules";
import { VENDOR_CATEGORIES } from "@/lib/constants";

// Re-export the input types so existing UI imports from this module keep working.
export type {
  VendorCatalogInput,
  VendorPackageInput,
  PackageItemInput,
  PackageSectionInput,
} from "@/lib/vendor/rules";

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: string; fields?: Record<string, string>; unmet?: string[] };
type Result<T> = Ok<T> | Err;

async function requirePerm(
  perm: "vendors:read" | "vendors:create" | "vendors:update" | "vendors:delete"
): Promise<{ id: string; role: string } | null> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const id = session?.user?.id;
  if (!id || !role || !hasPermission(role, perm)) return null;
  return { id, role };
}

// Rule logic (validateItem / activationUnmet / validateVendorFields) lives in
// @/lib/vendor/rules so it can be unit-tested in isolation — see rules.test.ts.

// Categories are dynamic: the hardcoded seed PLUS active VendorCategoryDef rows.
// This merged set is the source of truth for "is this a valid category key?"
// on the DB-dependent create/update paths.
async function validCategoryKeys(): Promise<Set<string>> {
  const defs = await prisma.vendorCategoryDef.findMany({
    where: { isActive: true },
    select: { key: true },
  });
  const set = new Set<string>(VENDOR_CATEGORIES.map((c) => c.key));
  for (const d of defs) set.add(d.key);
  return set;
}

// Normalise the venue scope for persistence. When allVenues is true, the
// specific venueIds are cleared (allVenues overrides). Otherwise dedupe + trim
// AND filter to ids that reference real Venue rows (never persist junk ids).
async function resolveVenueScope(input: VendorCatalogInput): Promise<{ allVenues: boolean; venueIds: string[] }> {
  const allVenues = input.allVenues === true;
  if (allVenues) return { allVenues: true, venueIds: [] };
  const requested = Array.from(
    new Set((input.venueIds ?? []).map((v) => v?.trim()).filter((v): v is string => !!v))
  );
  if (requested.length === 0) return { allVenues: false, venueIds: [] };
  const valid = await prisma.venue.findMany({
    where: { id: { in: requested } },
    select: { id: true },
  });
  const validSet = new Set(valid.map((r) => r.id));
  return { allVenues: false, venueIds: requested.filter((id) => validSet.has(id)) };
}

function normaliseVendorType(input: VendorCatalogInput): string {
  const t = input.vendorType?.trim();
  return t && VENDOR_TYPES.includes(t) ? t : "EXTERNAL";
}

// Build the pricing columns for a package. `price` is the legacy customer-price
// mirror, kept in sync with customerPrice (customerPrice defaults from price).
function packagePricingData(input: VendorPackageInput) {
  const customer = input.customerPrice != null ? Number(input.customerPrice) : Number(input.price);
  const hasDiscount = !!input.maxDiscountType && input.maxDiscountType !== "";
  return {
    price: customer, // legacy readers stay correct (price = customerPrice)
    customerPrice: customer,
    vendorPrice: input.vendorPrice != null ? Number(input.vendorPrice) : null,
    minPax: input.minPax != null ? Math.trunc(Number(input.minPax)) : null,
    maxDiscountType: hasDiscount ? input.maxDiscountType : null,
    maxDiscountValue: hasDiscount ? Number(input.maxDiscountValue ?? 0) : null,
  };
}

// Normalise the graph for persistence (trim, drop empty options for fixed, order)
function buildSectionsCreate(sections: PackageSectionInput[]) {
  return sections.map((s, si) => ({
    title: s.title?.trim() || `Section ${si + 1}`,
    sortOrder: si,
    items: {
      create: (s.items ?? []).map((it, ii) => ({
        name: it.name.trim(),
        type: it.type as "FIXED" | "SINGLE_CHOICE" | "MULTI_CHOICE",
        options: it.type === "FIXED" ? [] : (it.options ?? []).map((o) => o.trim()).filter(Boolean),
        chooseCount: it.type === "MULTI_CHOICE" ? (it.chooseCount ?? 1) : null,
        sortOrder: ii,
        notes: it.notes?.trim() || null,
      })),
    },
  }));
}

// ============================================================
// VENDOR (catalog) actions
// ============================================================

export async function listCatalogVendors(params?: {
  search?: string;
  category?: string;
  status?: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<Result<{ data: unknown[]; total: number; page: number; pageSize: number }>> {
  const u = await requirePerm("vendors:read");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, params?.pageSize ?? 50);
    const where: Prisma.VendorWhereInput = {};
    if (!params?.includeArchived) where.isArchived = false;
    if (params?.search) where.name = { contains: params.search, mode: "insensitive" };
    // Category filter accepts any key (dynamic categories included).
    if (params?.category) where.categories = { has: params.category };
    if (params?.status) where.empanelmentStatus = params.status;

    const [rows, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        select: {
          id: true, name: true, categories: true, category: true, city: true,
          email: true, phone: true, empanelmentStatus: true, qualityScore: true,
          isArchived: true, vendorType: true, venueIds: true, allVenues: true,
          _count: { select: { packages: true } },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vendor.count({ where }),
    ]);
    const data = rows.map((v) => ({ ...v, packageCount: v._count.packages }));
    return { success: true, data: serialize({ data, total, page, pageSize }) };
  } catch (e) {
    console.error("[LIST_CATALOG_VENDORS]", e);
    return { success: false, error: "Failed to load vendors" };
  }
}

export async function getCatalogVendor(id: string): Promise<Result<unknown>> {
  const u = await requirePerm("vendors:read");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const v = await prisma.vendor.findUnique({
      where: { id },
      include: {
        packages: {
          select: {
            id: true, name: true, status: true, category: true,
            price: true, customerPrice: true, priceUnit: true,
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    if (!v) return { success: false, error: "Vendor not found" };
    return { success: true, data: serialize(v) };
  } catch (e) {
    console.error("[GET_CATALOG_VENDOR]", e);
    return { success: false, error: "Failed to load vendor" };
  }
}

export async function createCatalogVendor(input: VendorCatalogInput): Promise<Result<{ id: string }>> {
  const u = await requirePerm("vendors:create");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const fields = validateVendorFields(input);
    if (Object.keys(fields).length) return { success: false, error: "Validation failed", fields };

    // R2 — unique name, case-insensitive
    const dupe = await prisma.vendor.findFirst({
      where: { name: { equals: input.name.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (dupe) return { success: false, error: "Validation failed", fields: { name: "A vendor with this name already exists" } };

    // Also guard email/phone here — the other create path (vendor.actions) checks
    // contact keys, so a shared guard on BOTH paths prevents a dupe slipping in via
    // either (no DB unique constraint yet — deferred until prod data is cleaned).
    const emailT = input.email?.trim() || null;
    const phoneT = input.phone?.trim() || null;
    if (emailT || phoneT) {
      const contactDupe = await prisma.vendor.findFirst({
        where: {
          OR: [
            ...(emailT ? [{ email: { equals: emailT, mode: "insensitive" as const } }] : []),
            ...(phoneT ? [{ phone: phoneT }] : []),
          ],
        },
        select: { id: true, name: true },
      });
      if (contactDupe)
        return {
          success: false,
          error: "Validation failed",
          fields: { [emailT ? "email" : "phone"]: `A vendor with this ${emailT ? "email" : "phone"} already exists (${contactDupe.name})` },
        };
    }

    const validKeys = await validCategoryKeys();
    const cats = input.categories.map((c) => c?.trim()).filter((c): c is string => !!c && validKeys.has(c));
    if (cats.length < 1) return { success: false, error: "Validation failed", fields: { categories: "Select at least one valid category" } };
    const { allVenues, venueIds } = await resolveVenueScope(input);
    const v = await prisma.vendor.create({
      data: {
        name: input.name.trim(),
        category: LEGACY_CATEGORY[cats[0]] ?? "OTHER",
        categories: cats,
        vendorType: normaliseVendorType(input),
        venueIds,
        allVenues,
        company: input.contactPerson?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        city: input.city?.trim() || "Bengaluru",
        empanelmentStatus: input.empanelmentStatus || "empanelled",
        keyPersonnel: (input.keyPersonnel ?? []) as unknown as Prisma.InputJsonValue,
        licences: (input.licences ?? []) as unknown as Prisma.InputJsonValue,
        notes: input.notes?.trim() || null,
      },
      select: { id: true },
    });
    await logActivity({ userId: u.id, action: "created", entityType: "Vendor", entityId: v.id });
    revalidatePath("/vendors");
    return { success: true, data: { id: v.id } };
  } catch (e) {
    console.error("[CREATE_CATALOG_VENDOR]", e);
    return { success: false, error: "Failed to create vendor" };
  }
}

export async function updateCatalogVendor(
  id: string,
  input: VendorCatalogInput
): Promise<Result<{ id: string; affectedPackages: { id: string; name: string; category: string }[] }>> {
  const u = await requirePerm("vendors:update");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const fields = validateVendorFields(input);
    if (Object.keys(fields).length) return { success: false, error: "Validation failed", fields };

    const existing = await prisma.vendor.findUnique({
      where: { id },
      select: { id: true, categories: true },
    });
    if (!existing) return { success: false, error: "Vendor not found" };

    const dupe = await prisma.vendor.findFirst({
      where: { name: { equals: input.name.trim(), mode: "insensitive" }, id: { not: id } },
      select: { id: true },
    });
    if (dupe) return { success: false, error: "Validation failed", fields: { name: "A vendor with this name already exists" } };

    // R3 (fix): on UPDATE the allowed set is the ACTIVE valid keys PLUS the keys
    // the vendor already has — so a category that was later deactivated is
    // preserved (not silently stripped, which would orphan its packages).
    // Only brand-new keys must be in the active set.
    const validKeys = await validCategoryKeys();
    for (const k of existing.categories) validKeys.add(k);
    const cats = input.categories.map((c) => c?.trim()).filter((c): c is string => !!c && validKeys.has(c));
    if (cats.length < 1) return { success: false, error: "Validation failed", fields: { categories: "Select at least one valid category" } };

    // MERGE semantics: only overwrite a column when the input actually provides
    // a value. Fields the edit form omits (undefined) are left untouched so we
    // never clobber existing keyPersonnel/licences/notes/contact/etc. with null.
    const data: Prisma.VendorUpdateInput = {
      name: input.name.trim(),
      category: LEGACY_CATEGORY[cats[0]] ?? "OTHER",
      categories: cats,
    };
    if (input.vendorType !== undefined) data.vendorType = normaliseVendorType(input);
    if (input.contactPerson !== undefined) data.company = input.contactPerson?.trim() || null;
    if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
    if (input.email !== undefined) data.email = input.email?.trim() || null;
    if (input.city !== undefined) data.city = input.city?.trim() || "Bengaluru";
    if (input.empanelmentStatus !== undefined) data.empanelmentStatus = input.empanelmentStatus || "empanelled";
    if (input.keyPersonnel !== undefined) data.keyPersonnel = input.keyPersonnel as unknown as Prisma.InputJsonValue;
    if (input.licences !== undefined) data.licences = input.licences as unknown as Prisma.InputJsonValue;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    // Venue scope is a paired concept (allVenues overrides venueIds); only touch
    // it when the input actually carries venue intent — otherwise preserve.
    if (input.allVenues !== undefined || input.venueIds !== undefined) {
      const { allVenues, venueIds } = await resolveVenueScope(input);
      data.allVenues = allVenues;
      data.venueIds = venueIds;
    }
    await prisma.vendor.update({ where: { id }, data });

    // R3 — flag packages whose category is no longer one of the vendor's categories
    const affected = await prisma.vendorPackage.findMany({
      where: { vendorId: id, category: { notIn: cats } },
      select: { id: true, name: true, category: true },
    });

    await logActivity({ userId: u.id, action: "updated", entityType: "Vendor", entityId: id });
    revalidatePath("/vendors");
    revalidatePath(`/vendors/${id}`);
    return { success: true, data: { id, affectedPackages: affected } };
  } catch (e) {
    console.error("[UPDATE_CATALOG_VENDOR]", e);
    return { success: false, error: "Failed to update vendor" };
  }
}

// R10 — soft delete (archive) / restore
export async function archiveVendor(id: string): Promise<Result<{ id: string }>> {
  const u = await requirePerm("vendors:delete");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    await prisma.vendor.update({ where: { id }, data: { isArchived: true } });
    await logActivity({ userId: u.id, action: "archived", entityType: "Vendor", entityId: id });
    revalidatePath("/vendors");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[ARCHIVE_VENDOR]", e);
    return { success: false, error: "Failed to archive vendor" };
  }
}

export async function restoreVendor(id: string): Promise<Result<{ id: string }>> {
  const u = await requirePerm("vendors:delete");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    await prisma.vendor.update({ where: { id }, data: { isArchived: false } });
    await logActivity({ userId: u.id, action: "restored", entityType: "Vendor", entityId: id });
    revalidatePath("/vendors");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[RESTORE_VENDOR]", e);
    return { success: false, error: "Failed to restore vendor" };
  }
}

// ============================================================
// PACKAGE actions
// ============================================================

export async function listPackages(params?: {
  search?: string;
  category?: string;
  vendorId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<Result<{ data: unknown[]; total: number; page: number; pageSize: number }>> {
  const u = await requirePerm("vendors:read");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, params?.pageSize ?? 50);
    const where: Prisma.VendorPackageWhereInput = { vendor: { isArchived: false } };
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { vendor: { name: { contains: params.search, mode: "insensitive" } } },
      ];
    }
    if (params?.category) where.category = params.category;
    if (params?.vendorId) where.vendorId = params.vendorId;
    if (params?.status) where.status = params.status as "DRAFT" | "ACTIVE" | "ARCHIVED";

    const [rows, total] = await Promise.all([
      prisma.vendorPackage.findMany({
        where,
        select: {
          id: true, name: true, category: true, status: true, price: true, priceUnit: true,
          currency: true, description: true, coverImageId: true,
          vendor: { select: { id: true, name: true } },
          images: { select: { id: true, url: true }, orderBy: { sortOrder: "asc" } },
          _count: { select: { sections: true } },
          sections: { select: { _count: { select: { items: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vendorPackage.count({ where }),
    ]);
    const data = rows.map((p) => {
      const cover = p.images.find((i) => i.id === p.coverImageId) ?? p.images[0] ?? null;
      const itemCount = p.sections.reduce((a, s) => a + s._count.items, 0);
      return {
        id: p.id, name: p.name, category: p.category, status: p.status,
        price: p.price, priceUnit: p.priceUnit, currency: p.currency, description: p.description,
        vendor: p.vendor, coverUrl: cover?.url ?? null,
        sectionCount: p._count.sections, itemCount,
      };
    });
    return { success: true, data: serialize({ data, total, page, pageSize }) };
  } catch (e) {
    console.error("[LIST_PACKAGES]", e);
    return { success: false, error: "Failed to load packages" };
  }
}

export async function getPackage(id: string): Promise<Result<unknown>> {
  const u = await requirePerm("vendors:read");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const p = await prisma.vendorPackage.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, name: true, categories: true } },
        sections: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!p) return { success: false, error: "Package not found" };
    return { success: true, data: serialize(p) };
  } catch (e) {
    console.error("[GET_PACKAGE]", e);
    return { success: false, error: "Failed to load package" };
  }
}

export async function createPackage(input: VendorPackageInput): Promise<Result<{ id: string }>> {
  const u = await requirePerm("vendors:create");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const fields: Record<string, string> = {};
    if (!input.vendorId) fields.vendorId = "Select a vendor";
    if (!input.name?.trim()) fields.name = "Package name is required";
    if (!(Number(input.price) >= 0)) fields.price = "Price must be ≥ 0"; // R6
    if (!PRICE_UNITS.includes(input.priceUnit)) fields.priceUnit = "Select a price unit";
    Object.assign(fields, validatePackagePricing(input)); // R6 extras
    if (Object.keys(fields).length) return { success: false, error: "Validation failed", fields };

    const vendor = await prisma.vendor.findUnique({
      where: { id: input.vendorId },
      select: { id: true, categories: true },
    });
    if (!vendor) return { success: false, error: "Validation failed", fields: { vendorId: "Vendor not found" } };
    // R3 — category must be one of the vendor's categories
    if (!vendor.categories.includes(input.category))
      return { success: false, error: "Validation failed", fields: { category: "Category must be one of the vendor's categories" } };

    // Dedup: a vendor can't have two packages with the same name (case-insensitive).
    // createPackage previously had no name guard at all — fully unconstrained.
    const pkgDupe = await prisma.vendorPackage.findFirst({
      where: { vendorId: input.vendorId, name: { equals: input.name.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (pkgDupe) return { success: false, error: "Validation failed", fields: { name: "This vendor already has a package with that name" } };

    // Per-item R4 (block save on malformed options regardless of status)
    for (const s of input.sections ?? []) for (const it of s.items ?? []) {
      const e = validateItem(it);
      if (e) return { success: false, error: "Validation failed", fields: { items: e } };
    }

    // R5/R13 — only allow ACTIVE if it qualifies; else fall back to DRAFT.
    // (fix) An ACTIVE package's category must also be in the active dynamic set —
    // a retired category can only host DRAFT packages, never live ones.
    let status: "DRAFT" | "ACTIVE" | "ARCHIVED" = "DRAFT";
    if (input.status === "ACTIVE") {
      const unmet = activationUnmet(input);
      const activeKeys = await validCategoryKeys();
      if (!activeKeys.has(input.category)) unmet.push("category is retired — reactivate it or pick a current category");
      if (unmet.length) return { success: false, error: "CANNOT_ACTIVATE", unmet };
      status = "ACTIVE";
    }

    const created = await prisma.vendorPackage.create({
      data: {
        vendorId: input.vendorId,
        name: input.name.trim(),
        category: input.category,
        status,
        ...packagePricingData(input),
        priceUnit: input.priceUnit as "PER_PLATE" | "PER_EVENT" | "PER_PIECE" | "PER_HOUR" | "PER_DAY",
        currency: input.currency || "INR",
        description: input.description?.trim() || null,
        sections: { create: buildSectionsCreate(input.sections ?? []) },
      },
      select: { id: true },
    });
    await logActivity({ userId: u.id, action: "created", entityType: "VendorPackage", entityId: created.id });
    revalidatePath("/vendors");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    console.error("[CREATE_PACKAGE]", e);
    return { success: false, error: "Failed to create package" };
  }
}

export async function updatePackage(id: string, input: VendorPackageInput): Promise<Result<{ id: string }>> {
  const u = await requirePerm("vendors:update");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const existing = await prisma.vendorPackage.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return { success: false, error: "Package not found" };

    const fields: Record<string, string> = {};
    if (!input.name?.trim()) fields.name = "Package name is required";
    if (!(Number(input.price) >= 0)) fields.price = "Price must be ≥ 0";
    if (!PRICE_UNITS.includes(input.priceUnit)) fields.priceUnit = "Select a price unit";
    Object.assign(fields, validatePackagePricing(input)); // R6 extras
    if (Object.keys(fields).length) return { success: false, error: "Validation failed", fields };

    const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId }, select: { categories: true } });
    if (!vendor) return { success: false, error: "Validation failed", fields: { vendorId: "Vendor not found" } };
    if (!vendor.categories.includes(input.category))
      return { success: false, error: "Validation failed", fields: { category: "Category must be one of the vendor's categories" } };

    for (const s of input.sections ?? []) for (const it of s.items ?? []) {
      const e = validateItem(it);
      if (e) return { success: false, error: "Validation failed", fields: { items: e } };
    }

    let status: "DRAFT" | "ACTIVE" | "ARCHIVED" = "DRAFT";
    if (input.status === "ACTIVE") {
      const unmet = activationUnmet(input);
      // (fix) mirror createPackage — an ACTIVE package's category must be in the
      // active dynamic set, not merely one of the vendor's (possibly retired) keys.
      const activeKeys = await validCategoryKeys();
      if (!activeKeys.has(input.category)) unmet.push("category is retired — reactivate it or pick a current category");
      if (unmet.length) return { success: false, error: "CANNOT_ACTIVATE", unmet };
      status = "ACTIVE";
    } else if (input.status === "ARCHIVED") {
      status = "ARCHIVED";
    }

    // Replace the whole section/item graph transactionally (R9, atomic).
    await prisma.$transaction(async (tx) => {
      await tx.vendorPackageSection.deleteMany({ where: { packageId: id } });
      await tx.vendorPackage.update({
        where: { id },
        data: {
          vendorId: input.vendorId,
          name: input.name.trim(),
          category: input.category,
          status,
          ...packagePricingData(input),
          priceUnit: input.priceUnit as "PER_PLATE" | "PER_EVENT" | "PER_PIECE" | "PER_HOUR" | "PER_DAY",
          currency: input.currency || "INR",
          description: input.description?.trim() || null,
          sections: { create: buildSectionsCreate(input.sections ?? []) },
        },
      });
    });
    await logActivity({ userId: u.id, action: "updated", entityType: "VendorPackage", entityId: id });
    revalidatePath("/vendors");
    revalidatePath(`/vendors/packages/${id}`);
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[UPDATE_PACKAGE]", e);
    return { success: false, error: "Failed to update package" };
  }
}

// R5/R13 — status transitions
export async function setPackageStatus(id: string, status: string): Promise<Result<{ id: string; status: string }>> {
  const u = await requirePerm("vendors:update");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const p = await prisma.vendorPackage.findUnique({
      where: { id },
      include: { vendor: { select: { categories: true } }, sections: { include: { items: true } } },
    });
    if (!p) return { success: false, error: "Package not found" };

    if (status === "ACTIVE") {
      // R13 — archived must go back through draft first (re-validate)
      if (p.status === "ARCHIVED") return { success: false, error: "Archive must be re-opened to draft before activating" };
      const asInput: VendorPackageInput = {
        vendorId: p.vendorId, name: p.name, category: p.category, price: Number(p.price),
        priceUnit: p.priceUnit, sections: p.sections.map((s) => ({
          title: s.title, items: s.items.map((it) => ({ name: it.name, type: it.type, options: it.options, chooseCount: it.chooseCount })),
        })),
      };
      const unmet = activationUnmet(asInput);
      if (!p.vendor.categories.includes(p.category)) unmet.push("category no longer valid for this vendor"); // R3
      if (unmet.length) return { success: false, error: "CANNOT_ACTIVATE", unmet };
    }
    if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) return { success: false, error: "Invalid status" };

    await prisma.vendorPackage.update({ where: { id }, data: { status: status as "DRAFT" | "ACTIVE" | "ARCHIVED" } });
    await logActivity({ userId: u.id, action: `status → ${status}`, entityType: "VendorPackage", entityId: id });
    revalidatePath("/vendors");
    revalidatePath(`/vendors/packages/${id}`);
    return { success: true, data: { id, status } };
  } catch (e) {
    console.error("[SET_PACKAGE_STATUS]", e);
    return { success: false, error: "Failed to change status" };
  }
}

export async function deletePackage(id: string): Promise<Result<{ id: string }>> {
  const u = await requirePerm("vendors:delete");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    // R9 — cascade deletes sections/items/images via schema onDelete: Cascade.
    // (BEO snapshot is a copy, not a reference — see extension point — so a
    //  package is safe to delete; events keep their snapshot.)
    await prisma.vendorPackage.delete({ where: { id } });
    await logActivity({ userId: u.id, action: "deleted", entityType: "VendorPackage", entityId: id });
    revalidatePath("/vendors");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[DELETE_PACKAGE]", e);
    return { success: false, error: "Failed to delete package" };
  }
}

// ============================================================
// IMAGE actions (URL-referenced — app convention)
// ============================================================

export async function addPackageImage(packageId: string, url: string): Promise<Result<{ id: string }>> {
  const u = await requirePerm("vendors:update");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const trimmed = url?.trim() ?? "";
    // (fix) Only accept https URLs OR base64 image data-URLs. Blocks
    // javascript:, data:text/html, etc. (stored-XSS hardening) — plain http is
    // rejected too.
    const isDataImage = /^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed);
    const isHttps = /^https:\/\//i.test(trimmed);
    if (!trimmed || !(isHttps || isDataImage))
      return { success: false, error: "Enter a valid https image URL or upload an image" };
    // (fix) Server-side size cap: the client 1.5MB guard is bypassable and a huge
    // base64 data-URL bloats the @db.Text column. Cap data URLs at ~1.6MB.
    if (isDataImage && trimmed.length > 2_200_000)
      return { success: false, error: "Image is too large — please upload an image under 1.5MB" };
    const pkg = await prisma.vendorPackage.findUnique({ where: { id: packageId }, select: { id: true } });
    if (!pkg) return { success: false, error: "Package not found" };
    const count = await prisma.vendorPackageImage.count({ where: { packageId } });
    const img = await prisma.vendorPackageImage.create({
      data: { packageId, url: trimmed, sortOrder: count },
      select: { id: true },
    });
    // R8 — first image (no cover) becomes the cover automatically.
    // Set atomically so only one concurrent first-upload wins (no read-then-write race).
    await prisma.vendorPackage.updateMany({
      where: { id: packageId, coverImageId: null },
      data: { coverImageId: img.id },
    });
    revalidatePath(`/vendors/packages/${packageId}`);
    return { success: true, data: { id: img.id } };
  } catch (e) {
    console.error("[ADD_PACKAGE_IMAGE]", e);
    return { success: false, error: "Failed to add image" };
  }
}

// R7 — set cover; must belong to the package
export async function setPackageCover(packageId: string, imageId: string): Promise<Result<{ coverImageId: string }>> {
  const u = await requirePerm("vendors:update");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const pkg = await prisma.vendorPackage.findUnique({ where: { id: packageId }, select: { id: true } });
    if (!pkg) return { success: false, error: "Package not found" };
    const img = await prisma.vendorPackageImage.findFirst({ where: { id: imageId, packageId }, select: { id: true } });
    if (!img) return { success: false, error: "Image does not belong to this package" };
    await prisma.vendorPackage.update({ where: { id: packageId }, data: { coverImageId: imageId } });
    revalidatePath(`/vendors/packages/${packageId}`);
    return { success: true, data: { coverImageId: imageId } };
  } catch (e) {
    console.error("[SET_PACKAGE_COVER]", e);
    return { success: false, error: "Failed to set cover" };
  }
}

// R7 — delete; reassign cover to next image (by sortOrder) or null
export async function deletePackageImage(packageId: string, imageId: string): Promise<Result<{ id: string }>> {
  const u = await requirePerm("vendors:update");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const pkg = await prisma.vendorPackage.findUnique({ where: { id: packageId }, select: { id: true, coverImageId: true } });
    if (!pkg) return { success: false, error: "Package not found" };
    await prisma.vendorPackageImage.deleteMany({ where: { id: imageId, packageId } });
    if (pkg?.coverImageId === imageId) {
      const next = await prisma.vendorPackageImage.findFirst({ where: { packageId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
      await prisma.vendorPackage.update({ where: { id: packageId }, data: { coverImageId: next?.id ?? null } });
    }
    revalidatePath(`/vendors/packages/${packageId}`);
    return { success: true, data: { id: imageId } };
  } catch (e) {
    console.error("[DELETE_PACKAGE_IMAGE]", e);
    return { success: false, error: "Failed to delete image" };
  }
}

// R11 — persist new image order atomically
export async function reorderPackageImages(packageId: string, orderedIds: string[]): Promise<Result<{ ok: true }>> {
  const u = await requirePerm("vendors:update");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const pkg = await prisma.vendorPackage.findUnique({ where: { id: packageId }, select: { id: true } });
    if (!pkg) return { success: false, error: "Package not found" };
    await prisma.$transaction(
      orderedIds.map((imgId, i) =>
        prisma.vendorPackageImage.updateMany({ where: { id: imgId, packageId }, data: { sortOrder: i } })
      )
    );
    revalidatePath(`/vendors/packages/${packageId}`);
    return { success: true, data: { ok: true } };
  } catch (e) {
    console.error("[REORDER_PACKAGE_IMAGES]", e);
    return { success: false, error: "Failed to reorder images" };
  }
}

// ------------------------------------------------------------
// BEO / Event snapshot — EXTENSION POINT (Section 8.1)
// ------------------------------------------------------------
// A future Event/BEO module should SNAPSHOT a package (deep-copy name, price,
// sections, items, and the client's chosen options) onto the event rather than
// referencing it, so the event preserves what was agreed even if the package
// later changes. Expose active packages by category for that picker:
export async function listActivePackagesForBeo(category?: string): Promise<Result<unknown[]>> {
  const u = await requirePerm("vendors:read");
  if (!u) return { success: false, error: "Unauthorized" };
  try {
    const rows = await prisma.vendorPackage.findMany({
      where: {
        status: "ACTIVE",
        vendor: { isArchived: false },
        ...(category && CATEGORY_KEYS.has(category) ? { category } : {}),
      },
      select: { id: true, name: true, category: true, price: true, priceUnit: true, vendor: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return { success: true, data: serialize(rows) };
    // TODO(BEO): add snapshotPackageToEvent(packageId, eventId, choices) that
    // deep-copies the graph + captures single_choice/multi_choice selections.
  } catch (e) {
    console.error("[LIST_ACTIVE_PACKAGES_FOR_BEO]", e);
    return { success: false, error: "Failed to load packages" };
  }
}

// ============================================================
// BEO package snapshot — freeze a vendor package's agreed scope + price onto a BEO
// so later edits to the live VendorPackage can't drift a committed event. Deep-
// copies sections/items and captures single/multi choice selections.
// ============================================================
async function requireBeoEdit(): Promise<{ id: string; role: string } | null> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const id = session?.user?.id;
  if (!id || !role || !hasPermission(role, "operations:update")) return null;
  return { id, role };
}

export async function snapshotPackageToEvent(input: {
  packageId: string;
  beoId: string;
  choices?: Record<string, string[]>;
}): Promise<Result<{ count: number }>> {
  const u = await requireBeoEdit();
  if (!u) return { success: false, error: "Unauthorized" };
  const pkg = await prisma.vendorPackage.findUnique({
    where: { id: input.packageId },
    select: {
      id: true, name: true, category: true, vendorPrice: true, price: true, priceUnit: true,
      vendor: { select: { name: true } },
      sections: {
        orderBy: { sortOrder: "asc" },
        select: { title: true, items: { orderBy: { sortOrder: "asc" }, select: { name: true, type: true, options: true, chooseCount: true } } },
      },
    },
  });
  if (!pkg) return { success: false, error: "Package not found" };
  const beo = await prisma.beo.findUnique({ where: { id: input.beoId }, select: { id: true, status: true, packageSnapshotJson: true } });
  if (!beo) return { success: false, error: "BEO not found" };
  if (beo.status === "LOCKED") return { success: false, error: "This BEO is locked." };

  const snapshot = {
    snapshotId: `${pkg.id}-${Date.now()}`,
    vendorPackageId: pkg.id,
    vendorName: pkg.vendor.name,
    name: pkg.name,
    category: pkg.category,
    vendorPrice: Number(pkg.vendorPrice ?? pkg.price),
    priceUnit: pkg.priceUnit,
    sections: pkg.sections.map((s) => ({
      title: s.title,
      items: s.items.map((it) => ({ name: it.name, type: it.type, options: it.options, chosen: input.choices?.[it.name] ?? [] })),
    })),
    capturedAt: new Date().toISOString(),
  };
  const existing = Array.isArray(beo.packageSnapshotJson) ? (beo.packageSnapshotJson as unknown[]) : [];
  await prisma.beo.update({ where: { id: beo.id }, data: { packageSnapshotJson: [...existing, snapshot] as unknown as Prisma.InputJsonValue } });
  revalidatePath("/bookings");
  return { success: true, data: { count: existing.length + 1 } };
}

export async function getBeoPackageSnapshots(beoId: string): Promise<Result<unknown[]>> {
  const u = await requirePerm("vendors:read");
  if (!u) return { success: false, error: "Unauthorized" };
  const beo = await prisma.beo.findUnique({ where: { id: beoId }, select: { packageSnapshotJson: true } });
  if (!beo) return { success: false, error: "BEO not found" };
  return { success: true, data: Array.isArray(beo.packageSnapshotJson) ? (beo.packageSnapshotJson as unknown[]) : [] };
}

export async function removeBeoPackageSnapshot(beoId: string, snapshotId: string): Promise<Result<{ count: number }>> {
  const u = await requireBeoEdit();
  if (!u) return { success: false, error: "Unauthorized" };
  const beo = await prisma.beo.findUnique({ where: { id: beoId }, select: { id: true, status: true, packageSnapshotJson: true } });
  if (!beo) return { success: false, error: "BEO not found" };
  if (beo.status === "LOCKED") return { success: false, error: "This BEO is locked." };
  const existing = Array.isArray(beo.packageSnapshotJson) ? (beo.packageSnapshotJson as { snapshotId?: string }[]) : [];
  const next = existing.filter((s) => s?.snapshotId !== snapshotId);
  await prisma.beo.update({ where: { id: beo.id }, data: { packageSnapshotJson: next as unknown as Prisma.InputJsonValue } });
  revalidatePath("/bookings");
  return { success: true, data: { count: next.length } };
}
