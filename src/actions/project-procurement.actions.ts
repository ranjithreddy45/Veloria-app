"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
function canRead(role?: string) { return !!role && hasPermission(role, "projects:read"); }
function canManage(role?: string) { return role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role ?? "", "projects:manage"); }
const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? 0 : Number(d));

// ---- Vendors ----
export async function getProjectVendors() {
  const u = await requireUser();
  if (!canRead(u?.role)) return [];
  return prisma.projectVendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function upsertProjectVendor(input: { id?: string; name: string; trade?: string; phone?: string; email?: string; gstin?: string }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canManage(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.name?.trim()) return { success: false, error: "Vendor name is required." };
  const data = { name: input.name.trim(), trade: input.trade?.trim() || null, phone: input.phone?.trim() || null, email: input.email?.trim() || null, gstin: input.gstin?.trim() || null };
  const rec = input.id ? await prisma.projectVendor.update({ where: { id: input.id }, data }) : await prisma.projectVendor.create({ data });
  revalidatePath("/projects/vendors");
  return { success: true, data: { id: rec.id } };
}

// ---- Procurement for a project (work packages + POs + variance) ----
export async function getProjectProcurement(projectId: string) {
  const u = await requireUser();
  if (!canRead(u?.role)) return null;
  const project = await prisma.acqOnboardingProject.findUnique({
    where: { id: projectId },
    select: { id: true, property: { select: { propertyName: true } } },
  });
  if (!project) return null;

  const [workPackages, pos, vendors, latestProjection] = await Promise.all([
    prisma.projectWorkPackage.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    prisma.projectPurchaseOrder.findMany({ where: { projectId }, include: { vendor: { select: { name: true } }, workPackage: { select: { title: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.projectVendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.acqCapexProjection.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" }, select: { totalCapex: true } }),
  ]);

  const plannedBudget = workPackages.reduce((s, w) => s + num(w.budgetAmount), 0);
  const committed = pos.filter((p) => ["ISSUED", "RECEIVED", "PAID"].includes(p.status)).reduce((s, p) => s + num(p.amount), 0);
  const paid = pos.filter((p) => p.status === "PAID").reduce((s, p) => s + num(p.amount), 0);
  const estimate = num(latestProjection?.totalCapex);

  return {
    project: { id: project.id, name: project.property?.propertyName ?? "Venue" },
    workPackages: workPackages.map((w) => ({ ...w, budgetAmount: num(w.budgetAmount) })),
    purchaseOrders: pos.map((p) => ({ id: p.id, number: p.number, description: p.description, amount: num(p.amount), status: p.status, vendor: p.vendor?.name ?? null, workPackage: p.workPackage?.title ?? null })),
    vendors,
    variance: {
      estimate, plannedBudget, committed, paid,
      // committed vs estimate: positive = under budget, negative = over.
      vsEstimate: estimate - committed,
      vsEstimatePct: estimate > 0 ? Math.round(((estimate - committed) / estimate) * 100) : null,
    },
    canManage: canManage(u?.role),
  };
}

export async function createWorkPackage(input: { projectId: string; title: string; categoryKey?: string; budgetAmount?: number }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canManage(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.title?.trim()) return { success: false, error: "Title required." };
  const max = await prisma.projectWorkPackage.aggregate({ where: { projectId: input.projectId }, _max: { order: true } });
  const w = await prisma.projectWorkPackage.create({
    data: { projectId: input.projectId, title: input.title.trim(), categoryKey: input.categoryKey || null, budgetAmount: input.budgetAmount ?? 0, order: (max._max.order ?? 0) + 1 },
  });
  revalidatePath(`/projects/${input.projectId}/procurement`);
  return { success: true, data: { id: w.id } };
}

export async function updateWorkPackage(id: string, input: { budgetAmount?: number; status?: string }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canManage(u?.role)) return { success: false, error: "Not authorized." };
  const wp = await prisma.projectWorkPackage.update({
    where: { id },
    data: {
      budgetAmount: input.budgetAmount !== undefined ? input.budgetAmount : undefined,
      status: input.status ? (input.status as Prisma.ProjectWorkPackageUpdateInput["status"]) : undefined,
    },
  });
  revalidatePath(`/projects/${wp.projectId}/procurement`);
  return { success: true, data: { id } };
}

export async function createPurchaseOrder(input: { projectId: string; description: string; amount: number; vendorId?: string; workPackageId?: string }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canManage(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.description?.trim()) return { success: false, error: "Description required." };
  if (!(input.amount > 0)) return { success: false, error: "Amount must be positive." };
  const po = await prisma.projectPurchaseOrder.create({
    data: { projectId: input.projectId, description: input.description.trim(), amount: input.amount, vendorId: input.vendorId || null, workPackageId: input.workPackageId || null },
  });
  revalidatePath(`/projects/${input.projectId}/procurement`);
  return { success: true, data: { id: po.id } };
}

export async function updatePurchaseOrderStatus(id: string, status: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canManage(u?.role)) return { success: false, error: "Not authorized." };
  const valid = ["DRAFT", "ISSUED", "RECEIVED", "PAID", "CANCELLED"];
  if (!valid.includes(status)) return { success: false, error: "Invalid status." };
  const po = await prisma.projectPurchaseOrder.update({
    where: { id },
    data: { status: status as Prisma.ProjectPurchaseOrderUpdateInput["status"], issuedAt: status === "ISSUED" ? new Date() : undefined },
  });
  revalidatePath(`/projects/${po.projectId}/procurement`);
  return { success: true, data: { id } };
}
