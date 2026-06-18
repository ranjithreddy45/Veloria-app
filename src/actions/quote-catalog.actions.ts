"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const CATEGORIES = ["HALL", "FOOD", "DECOR", "CAKE", "DRINKS", "ACTIVITY", "ROOM", "PHOTOGRAPHY"] as const;
const PRICING = ["PER_PLATE", "PER_PERSON", "PER_NIGHT", "PER_KG", "FLAT"] as const;
type Category = (typeof CATEGORIES)[number];
type Pricing = (typeof PRICING)[number];

async function requireRole() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as { role?: string }).role ?? "";
}
const dec = (v: Prisma.Decimal | number | null | undefined) =>
  v == null ? 0 : typeof v === "number" ? v : Number(v.toString());

export interface QuoteMenuItemDTO {
  id: string;
  groupName: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  extraCost: number;
  isActive: boolean;
  order: number;
}
export interface QuotePackageDTO {
  id: string;
  category: Category;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pricingType: Pricing;
  price: number;
  unitLabel: string | null;
  vendorId: string | null;
  isActive: boolean;
  order: number;
  menuItems: QuoteMenuItemDTO[];
}

function toDTO(p: {
  id: string; category: string; name: string; description: string | null; imageUrl: string | null;
  pricingType: string; price: Prisma.Decimal; unitLabel: string | null; vendorId: string | null;
  isActive: boolean; order: number;
  menuItems: { id: string; groupName: string | null; name: string; description: string | null; imageUrl: string | null; extraCost: Prisma.Decimal; isActive: boolean; order: number }[];
}): QuotePackageDTO {
  return {
    id: p.id, category: p.category as Category, name: p.name, description: p.description,
    imageUrl: p.imageUrl, pricingType: p.pricingType as Pricing, price: dec(p.price),
    unitLabel: p.unitLabel, vendorId: p.vendorId, isActive: p.isActive, order: p.order,
    menuItems: (p.menuItems ?? []).map((m) => ({
      id: m.id, groupName: m.groupName, name: m.name, description: m.description,
      imageUrl: m.imageUrl, extraCost: dec(m.extraCost), isActive: m.isActive, order: m.order,
    })),
  };
}

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------
export async function getQuotePackages(opts?: {
  category?: Category;
  activeOnly?: boolean;
}): Promise<Result<QuotePackageDTO[]>> {
  const role = await requireRole();
  if (role === null) return { success: false, error: "Unauthorized" };
  if (!hasPermission(role, "packages:read")) return { success: false, error: "Not authorized" };

  const where: Record<string, unknown> = {};
  if (opts?.category) where.category = opts.category;
  if (opts?.activeOnly) where.isActive = true;

  const rows = await prisma.quotePackage.findMany({
    where,
    orderBy: [{ category: "asc" }, { order: "asc" }, { name: "asc" }],
    include: { menuItems: { orderBy: [{ order: "asc" }, { name: "asc" }] } },
  });
  return { success: true, data: rows.map(toDTO) };
}

// ------------------------------------------------------------
// Package CRUD
// ------------------------------------------------------------
export interface QuotePackageInput {
  category: Category;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  pricingType: Pricing;
  price: number;
  unitLabel?: string | null;
  vendorId?: string | null;
  isActive?: boolean;
  order?: number;
}

function validatePackage(input: QuotePackageInput): string | null {
  if (!CATEGORIES.includes(input.category)) return "Invalid category";
  if (!PRICING.includes(input.pricingType)) return "Invalid pricing type";
  if (!input.name?.trim()) return "Name is required";
  if (!Number.isFinite(input.price) || input.price < 0) return "Price must be 0 or more";
  return null;
}

export async function createQuotePackage(input: QuotePackageInput): Promise<Result<{ id: string }>> {
  const role = await requireRole();
  if (role === null) return { success: false, error: "Unauthorized" };
  if (!hasPermission(role, "packages:create")) return { success: false, error: "Not authorized" };
  const err = validatePackage(input);
  if (err) return { success: false, error: err };

  const created = await prisma.quotePackage.create({
    data: {
      category: input.category as never,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      pricingType: input.pricingType as never,
      price: new Prisma.Decimal(input.price),
      unitLabel: input.unitLabel?.trim() || null,
      vendorId: input.vendorId || null,
      isActive: input.isActive ?? true,
      order: input.order ?? 0,
    },
    select: { id: true },
  });
  revalidatePath("/packages");
  revalidatePath("/quotations/new");
  return { success: true, data: { id: created.id } };
}

export async function updateQuotePackage(id: string, input: QuotePackageInput): Promise<Result<{ id: string }>> {
  const role = await requireRole();
  if (role === null) return { success: false, error: "Unauthorized" };
  if (!hasPermission(role, "packages:update")) return { success: false, error: "Not authorized" };
  const err = validatePackage(input);
  if (err) return { success: false, error: err };

  await prisma.quotePackage.update({
    where: { id },
    data: {
      category: input.category as never,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      pricingType: input.pricingType as never,
      price: new Prisma.Decimal(input.price),
      unitLabel: input.unitLabel?.trim() || null,
      vendorId: input.vendorId || null,
      isActive: input.isActive ?? true,
      order: input.order ?? 0,
    },
  });
  revalidatePath("/packages");
  revalidatePath("/quotations/new");
  return { success: true, data: { id } };
}

export async function deleteQuotePackage(id: string): Promise<Result<{ id: string }>> {
  const role = await requireRole();
  if (role === null) return { success: false, error: "Unauthorized" };
  if (!hasPermission(role, "packages:delete")) return { success: false, error: "Not authorized" };
  // Hard delete is safe: new table, menu items cascade, and quotations snapshot
  // their chosen packages in inputsJson (no FK from quotation to catalog).
  await prisma.quotePackage.delete({ where: { id } });
  revalidatePath("/packages");
  return { success: true, data: { id } };
}

export async function toggleQuotePackageActive(id: string): Promise<Result<{ id: string }>> {
  const role = await requireRole();
  if (role === null) return { success: false, error: "Unauthorized" };
  if (!hasPermission(role, "packages:update")) return { success: false, error: "Not authorized" };
  const p = await prisma.quotePackage.findUnique({ where: { id }, select: { isActive: true } });
  if (!p) return { success: false, error: "Package not found" };
  await prisma.quotePackage.update({ where: { id }, data: { isActive: !p.isActive } });
  revalidatePath("/packages");
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Menu-item CRUD (the selectable options inside a package)
// ------------------------------------------------------------
export interface QuoteMenuItemInput {
  groupName?: string | null;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  extraCost?: number;
  isActive?: boolean;
  order?: number;
}

export async function addQuoteMenuItem(packageId: string, input: QuoteMenuItemInput): Promise<Result<{ id: string }>> {
  const role = await requireRole();
  if (role === null) return { success: false, error: "Unauthorized" };
  if (!hasPermission(role, "packages:update")) return { success: false, error: "Not authorized" };
  if (!input.name?.trim()) return { success: false, error: "Item name is required" };
  const pkg = await prisma.quotePackage.findUnique({ where: { id: packageId }, select: { id: true } });
  if (!pkg) return { success: false, error: "Package not found" };

  const created = await prisma.quotePackageMenuItem.create({
    data: {
      packageId,
      groupName: input.groupName?.trim() || null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      extraCost: new Prisma.Decimal(Number.isFinite(input.extraCost) ? input.extraCost! : 0),
      isActive: input.isActive ?? true,
      order: input.order ?? 0,
    },
    select: { id: true },
  });
  revalidatePath("/packages");
  return { success: true, data: { id: created.id } };
}

export async function updateQuoteMenuItem(id: string, input: QuoteMenuItemInput): Promise<Result<{ id: string }>> {
  const role = await requireRole();
  if (role === null) return { success: false, error: "Unauthorized" };
  if (!hasPermission(role, "packages:update")) return { success: false, error: "Not authorized" };
  if (!input.name?.trim()) return { success: false, error: "Item name is required" };
  await prisma.quotePackageMenuItem.update({
    where: { id },
    data: {
      groupName: input.groupName?.trim() || null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      extraCost: new Prisma.Decimal(Number.isFinite(input.extraCost) ? input.extraCost! : 0),
      isActive: input.isActive ?? true,
      order: input.order ?? 0,
    },
  });
  revalidatePath("/packages");
  return { success: true, data: { id } };
}

export async function deleteQuoteMenuItem(id: string): Promise<Result<{ id: string }>> {
  const role = await requireRole();
  if (role === null) return { success: false, error: "Unauthorized" };
  if (!hasPermission(role, "packages:update")) return { success: false, error: "Not authorized" };
  await prisma.quotePackageMenuItem.delete({ where: { id } });
  revalidatePath("/packages");
  return { success: true, data: { id } };
}
