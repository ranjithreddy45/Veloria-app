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
  LEGACY_CATEGORY,
  validateItem,
  activationUnmet,
  validateVendorFields,
  type VendorCatalogInput,
  type VendorPackageInput,
  type PackageSectionInput,
} from "@/lib/vendor/rules";

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
    if (params?.category && CATEGORY_KEYS.has(params.category)) where.categories = { has: params.category };
    if (params?.status) where.empanelmentStatus = params.status;

    const [rows, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        select: {
          id: true, name: true, categories: true, category: true, city: true,
          email: true, phone: true, empanelmentStatus: true, qualityScore: true,
          isArchived: true, _count: { select: { packages: true } },
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
          select: { id: true, name: true, status: true, category: true, price: true, priceUnit: true },
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

    const cats = input.categories.filter((c) => CATEGORY_KEYS.has(c));
    const v = await prisma.vendor.create({
      data: {
        name: input.name.trim(),
        category: LEGACY_CATEGORY[cats[0]] ?? "OTHER",
        categories: cats,
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

    const existing = await prisma.vendor.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return { success: false, error: "Vendor not found" };

    const dupe = await prisma.vendor.findFirst({
      where: { name: { equals: input.name.trim(), mode: "insensitive" }, id: { not: id } },
      select: { id: true },
    });
    if (dupe) return { success: false, error: "Validation failed", fields: { name: "A vendor with this name already exists" } };

    const cats = input.categories.filter((c) => CATEGORY_KEYS.has(c));
    await prisma.vendor.update({
      where: { id },
      data: {
        name: input.name.trim(),
        category: LEGACY_CATEGORY[cats[0]] ?? "OTHER",
        categories: cats,
        company: input.contactPerson?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        city: input.city?.trim() || "Bengaluru",
        empanelmentStatus: input.empanelmentStatus || "empanelled",
        keyPersonnel: (input.keyPersonnel ?? []) as unknown as Prisma.InputJsonValue,
        licences: (input.licences ?? []) as unknown as Prisma.InputJsonValue,
        notes: input.notes?.trim() || null,
      },
    });

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
    if (params?.category && CATEGORY_KEYS.has(params.category)) where.category = params.category;
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
    if (Object.keys(fields).length) return { success: false, error: "Validation failed", fields };

    const vendor = await prisma.vendor.findUnique({
      where: { id: input.vendorId },
      select: { id: true, categories: true },
    });
    if (!vendor) return { success: false, error: "Validation failed", fields: { vendorId: "Vendor not found" } };
    // R3 — category must be one of the vendor's categories
    if (!vendor.categories.includes(input.category))
      return { success: false, error: "Validation failed", fields: { category: "Category must be one of the vendor's categories" } };

    // Per-item R4 (block save on malformed options regardless of status)
    for (const s of input.sections ?? []) for (const it of s.items ?? []) {
      const e = validateItem(it);
      if (e) return { success: false, error: "Validation failed", fields: { items: e } };
    }

    // R5/R13 — only allow ACTIVE if it qualifies; else fall back to DRAFT
    let status: "DRAFT" | "ACTIVE" | "ARCHIVED" = "DRAFT";
    if (input.status === "ACTIVE") {
      const unmet = activationUnmet(input);
      if (unmet.length) return { success: false, error: "CANNOT_ACTIVATE", unmet };
      status = "ACTIVE";
    }

    const created = await prisma.vendorPackage.create({
      data: {
        vendorId: input.vendorId,
        name: input.name.trim(),
        category: input.category,
        status,
        price: input.price,
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
          price: input.price,
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
    if (!url?.trim() || !/^https?:\/\//i.test(url.trim()))
      return { success: false, error: "Enter a valid image URL (http/https)" };
    const [count, hasCover] = await Promise.all([
      prisma.vendorPackageImage.count({ where: { packageId } }),
      prisma.vendorPackage.findUnique({ where: { id: packageId }, select: { coverImageId: true } }),
    ]);
    const img = await prisma.vendorPackageImage.create({
      data: { packageId, url: url.trim(), sortOrder: count },
      select: { id: true },
    });
    // R8 — first image (no cover) becomes the cover automatically
    if (!hasCover?.coverImageId) {
      await prisma.vendorPackage.update({ where: { id: packageId }, data: { coverImageId: img.id } });
    }
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
    const pkg = await prisma.vendorPackage.findUnique({ where: { id: packageId }, select: { coverImageId: true } });
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
