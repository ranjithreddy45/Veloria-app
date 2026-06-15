"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { postPurchaseReceived } from "@/lib/finance/procurement";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ------------------------------------------------------------
// Auth helpers
// ------------------------------------------------------------
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
const canRead = (r?: string) => !!r && hasPermission(r, "procurement:read");
const canWrite = (r?: string) => !!r && hasPermission(r, "procurement:write");

// ------------------------------------------------------------
// DTOs (Decimal -> Number, Date -> ISO string)
// ------------------------------------------------------------
export type PRItemDTO = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  lineTotal: number;
  received: boolean;
};

export type PRStatus = "PENDING" | "APPROVED" | "ORDERED" | "RECEIVED" | "REJECTED";

export type PRDTO = {
  id: string;
  prNumber: string;
  title: string;
  status: PRStatus;
  vendorId: string | null;
  vendorName: string | null;
  department: string | null;
  neededBy: string | null;
  notes: string | null;
  totalAmount: number;
  requestedById: string;
  approvedById: string | null;
  approvedAt: string | null;
  orderedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: PRItemDTO[];
};

const dec = (v: Prisma.Decimal | number | null | undefined) =>
  v == null ? 0 : typeof v === "number" ? v : Number(v.toString());

function itemDTO(it: {
  id: string; name: string; quantity: Prisma.Decimal; unit: string | null; unitPrice: Prisma.Decimal; received: boolean;
}): PRItemDTO {
  const quantity = dec(it.quantity);
  const unitPrice = dec(it.unitPrice);
  return {
    id: it.id,
    name: it.name,
    quantity,
    unit: it.unit,
    unitPrice,
    lineTotal: Math.round(quantity * unitPrice * 100) / 100,
    received: it.received,
  };
}

type PRRow = {
  id: string; prNumber: string; title: string; status: string; vendorId: string | null;
  department: string | null; neededBy: Date | null; notes: string | null; totalAmount: Prisma.Decimal;
  requestedById: string; approvedById: string | null; approvedAt: Date | null; orderedAt: Date | null;
  receivedAt: Date | null; createdAt: Date; updatedAt: Date;
};

function prDTO(
  pr: PRRow,
  items: PRItemDTO[],
  vendorName: string | null,
): PRDTO {
  return {
    id: pr.id,
    prNumber: pr.prNumber,
    title: pr.title,
    status: pr.status as PRStatus,
    vendorId: pr.vendorId,
    vendorName,
    department: pr.department,
    neededBy: pr.neededBy?.toISOString() ?? null,
    notes: pr.notes,
    totalAmount: dec(pr.totalAmount),
    requestedById: pr.requestedById,
    approvedById: pr.approvedById,
    approvedAt: pr.approvedAt?.toISOString() ?? null,
    orderedAt: pr.orderedAt?.toISOString() ?? null,
    receivedAt: pr.receivedAt?.toISOString() ?? null,
    createdAt: pr.createdAt.toISOString(),
    updatedAt: pr.updatedAt.toISOString(),
    items,
  };
}

// ------------------------------------------------------------
// Internal: recompute & persist totalAmount from current items
// ------------------------------------------------------------
function sumItems(items: { quantity: Prisma.Decimal | number; unitPrice: Prisma.Decimal | number }[]): number {
  return Math.round(
    items.reduce((acc, it) => acc + dec(it.quantity as Prisma.Decimal) * dec(it.unitPrice as Prisma.Decimal), 0) * 100,
  ) / 100;
}

async function recomputeTotal(prId: string): Promise<void> {
  const items = await prisma.purchaseRequisitionItem.findMany({
    where: { prId },
    select: { quantity: true, unitPrice: true },
  });
  await prisma.purchaseRequisition.update({
    where: { id: prId },
    data: { totalAmount: new Prisma.Decimal(sumItems(items)) },
  });
}

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------
export async function getPurchaseRequisitions(): Promise<Result<PRDTO[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const rows = await prisma.purchaseRequisition.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  // Resolve vendor names in one query.
  const vendorIds = [...new Set(rows.map((r) => r.vendorId).filter((v): v is string => !!v))];
  const vendors = vendorIds.length
    ? await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } })
    : [];
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));

  return {
    success: true,
    data: rows.map((r) =>
      prDTO(r, r.items.map(itemDTO), r.vendorId ? vendorName.get(r.vendorId) ?? null : null),
    ),
  };
}

export async function getPurchaseRequisition(id: string): Promise<Result<PRDTO>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const pr = await prisma.purchaseRequisition.findUnique({
    where: { id },
    include: { items: { orderBy: { name: "asc" } } },
  });
  if (!pr) return { success: false, error: "Requisition not found" };

  const vendorName = pr.vendorId
    ? (await prisma.vendor.findUnique({ where: { id: pr.vendorId }, select: { name: true } }))?.name ?? null
    : null;

  return { success: true, data: prDTO(pr, pr.items.map(itemDTO), vendorName) };
}

export async function getVendorOptions(): Promise<Result<{ id: string; name: string }[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const vendors = await prisma.vendor.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return { success: true, data: vendors };
}

// ------------------------------------------------------------
// PR number allocation: PR-YYYY-NNN, count()-based with P2002 retry
// ------------------------------------------------------------
async function allocatePrNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `PR-${year}-`;
  const seed = await prisma.purchaseRequisition.count({
    where: { prNumber: { startsWith: prefix } },
  });
  // count() gives a starting point; the create() caller retries on collision.
  return `${prefix}${String(seed + 1).padStart(3, "0")}`;
}

// ------------------------------------------------------------
// Create
// ------------------------------------------------------------
export async function createPurchaseRequisition(input: {
  title: string;
  bookingId?: string | null;
  vendorId?: string | null;
  department?: string | null;
  neededBy?: string | null;
  notes?: string | null;
  items: { name: string; quantity: number; unit?: string | null; unitPrice: number }[];
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const title = input.title?.trim();
  if (!title) return { success: false, error: "Title is required" };

  const items = (input.items ?? []).filter((it) => it.name?.trim());
  if (items.length === 0) return { success: false, error: "Add at least one line item" };
  for (const it of items) {
    if (!(Number(it.quantity) > 0)) return { success: false, error: `Quantity must be > 0 for "${it.name}"` };
    if (Number(it.unitPrice) < 0) return { success: false, error: `Unit price can't be negative for "${it.name}"` };
  }

  const totalAmount = sumItems(items.map((it) => ({ quantity: it.quantity, unitPrice: it.unitPrice })));
  const neededBy = input.neededBy ? new Date(input.neededBy) : null;

  // Retry on the unique-prNumber collision under concurrency.
  const MAX_RETRY = 5;
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const prNumber = await allocatePrNumber();
    try {
      const created = await prisma.purchaseRequisition.create({
        data: {
          prNumber,
          title,
          status: "PENDING",
          bookingId: input.bookingId || null,
          vendorId: input.vendorId || null,
          department: input.department?.trim() || null,
          neededBy,
          notes: input.notes?.trim() || null,
          totalAmount: new Prisma.Decimal(totalAmount),
          requestedById: u.id,
          items: {
            create: items.map((it) => ({
              name: it.name.trim(),
              quantity: new Prisma.Decimal(Number(it.quantity)),
              unit: it.unit?.trim() || null,
              unitPrice: new Prisma.Decimal(Number(it.unitPrice)),
            })),
          },
        },
        select: { id: true },
      });
      revalidatePath("/procurement");
      return { success: true, data: { id: created.id } };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        continue; // prNumber raced — recompute and retry
      }
      throw e;
    }
  }
  return { success: false, error: "Could not allocate a PR number, please retry" };
}

// ------------------------------------------------------------
// Update (header) — only while PENDING
// ------------------------------------------------------------
export async function updatePurchaseRequisition(
  id: string,
  patch: {
    title?: string;
    vendorId?: string | null;
    department?: string | null;
    neededBy?: string | null;
    notes?: string | null;
  },
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const pr = await prisma.purchaseRequisition.findUnique({ where: { id }, select: { status: true } });
  if (!pr) return { success: false, error: "Requisition not found" };
  if (pr.status !== "PENDING") return { success: false, error: "Only a pending requisition can be edited." };

  const data: Prisma.PurchaseRequisitionUpdateInput = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { success: false, error: "Title is required" };
    data.title = t;
  }
  if (patch.vendorId !== undefined) data.vendorId = patch.vendorId || null;
  if (patch.department !== undefined) data.department = patch.department?.trim() || null;
  if (patch.neededBy !== undefined) data.neededBy = patch.neededBy ? new Date(patch.neededBy) : null;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;

  await prisma.purchaseRequisition.update({ where: { id }, data });
  revalidatePath(`/procurement/${id}`);
  revalidatePath("/procurement");
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Item CRUD — only while PENDING; recompute totalAmount on change
// ------------------------------------------------------------
async function assertPending(prId: string): Promise<Result<true>> {
  const pr = await prisma.purchaseRequisition.findUnique({ where: { id: prId }, select: { status: true } });
  if (!pr) return { success: false, error: "Requisition not found" };
  if (pr.status !== "PENDING") return { success: false, error: "Items can only be changed while pending." };
  return { success: true, data: true };
}

export async function addPurchaseRequisitionItem(
  prId: string,
  item: { name: string; quantity: number; unit?: string | null; unitPrice: number },
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const guard = await assertPending(prId);
  if (!guard.success) return guard;

  if (!item.name?.trim()) return { success: false, error: "Item name is required" };
  if (!(Number(item.quantity) > 0)) return { success: false, error: "Quantity must be > 0" };
  if (Number(item.unitPrice) < 0) return { success: false, error: "Unit price can't be negative" };

  await prisma.purchaseRequisitionItem.create({
    data: {
      prId,
      name: item.name.trim(),
      quantity: new Prisma.Decimal(Number(item.quantity)),
      unit: item.unit?.trim() || null,
      unitPrice: new Prisma.Decimal(Number(item.unitPrice)),
    },
  });
  await recomputeTotal(prId);
  revalidatePath(`/procurement/${prId}`);
  return { success: true, data: { id: prId } };
}

export async function updatePurchaseRequisitionItem(
  itemId: string,
  patch: { name?: string; quantity?: number; unit?: string | null; unitPrice?: number },
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const existing = await prisma.purchaseRequisitionItem.findUnique({ where: { id: itemId }, select: { prId: true } });
  if (!existing) return { success: false, error: "Item not found" };
  const guard = await assertPending(existing.prId);
  if (!guard.success) return guard;

  const data: Prisma.PurchaseRequisitionItemUpdateInput = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) return { success: false, error: "Item name is required" };
    data.name = patch.name.trim();
  }
  if (patch.quantity !== undefined) {
    if (!(Number(patch.quantity) > 0)) return { success: false, error: "Quantity must be > 0" };
    data.quantity = new Prisma.Decimal(Number(patch.quantity));
  }
  if (patch.unit !== undefined) data.unit = patch.unit?.trim() || null;
  if (patch.unitPrice !== undefined) {
    if (Number(patch.unitPrice) < 0) return { success: false, error: "Unit price can't be negative" };
    data.unitPrice = new Prisma.Decimal(Number(patch.unitPrice));
  }

  await prisma.purchaseRequisitionItem.update({ where: { id: itemId }, data });
  await recomputeTotal(existing.prId);
  revalidatePath(`/procurement/${existing.prId}`);
  return { success: true, data: { id: existing.prId } };
}

export async function deletePurchaseRequisitionItem(itemId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const existing = await prisma.purchaseRequisitionItem.findUnique({ where: { id: itemId }, select: { prId: true } });
  if (!existing) return { success: false, error: "Item not found" };
  const guard = await assertPending(existing.prId);
  if (!guard.success) return guard;

  await prisma.purchaseRequisitionItem.delete({ where: { id: itemId } });
  await recomputeTotal(existing.prId);
  revalidatePath(`/procurement/${existing.prId}`);
  return { success: true, data: { id: existing.prId } };
}

// ------------------------------------------------------------
// Lifecycle (status machine, write-gated)
//   PENDING  -> APPROVED  (approvePR, maker-checker: no self-approve)
//   PENDING  -> REJECTED  (rejectPR)
//   APPROVED -> ORDERED   (markOrdered)
//   ORDERED  -> RECEIVED  (markReceived, all items received=true)
// ------------------------------------------------------------
export async function approvePR(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const pr = await prisma.purchaseRequisition.findUnique({
    where: { id },
    select: { status: true, requestedById: true },
  });
  if (!pr) return { success: false, error: "Requisition not found" };
  if (pr.status !== "PENDING") return { success: false, error: "Only a pending requisition can be approved." };
  if (pr.requestedById === u.id) {
    return { success: false, error: "You can't approve your own requisition (maker-checker)." };
  }

  await prisma.purchaseRequisition.update({
    where: { id },
    data: { status: "APPROVED", approvedById: u.id, approvedAt: new Date() },
  });
  revalidatePath(`/procurement/${id}`);
  revalidatePath("/procurement");
  return { success: true, data: { id } };
}

export async function rejectPR(id: string, reason?: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const pr = await prisma.purchaseRequisition.findUnique({ where: { id }, select: { status: true, notes: true } });
  if (!pr) return { success: false, error: "Requisition not found" };
  if (pr.status !== "PENDING") return { success: false, error: "Only a pending requisition can be rejected." };

  const trimmed = reason?.trim();
  const notes = trimmed
    ? `${pr.notes ? `${pr.notes}\n\n` : ""}Rejected: ${trimmed}`
    : pr.notes;

  await prisma.purchaseRequisition.update({
    where: { id },
    data: { status: "REJECTED", approvedById: u.id, approvedAt: new Date(), notes },
  });
  revalidatePath(`/procurement/${id}`);
  revalidatePath("/procurement");
  return { success: true, data: { id } };
}

export async function markOrdered(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const pr = await prisma.purchaseRequisition.findUnique({ where: { id }, select: { status: true } });
  if (!pr) return { success: false, error: "Requisition not found" };
  if (pr.status !== "APPROVED") return { success: false, error: "Only an approved requisition can be ordered." };

  await prisma.purchaseRequisition.update({
    where: { id },
    data: { status: "ORDERED", orderedAt: new Date() },
  });
  revalidatePath(`/procurement/${id}`);
  revalidatePath("/procurement");
  return { success: true, data: { id } };
}

export async function markReceived(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const pr = await prisma.purchaseRequisition.findUnique({ where: { id }, select: { status: true } });
  if (!pr) return { success: false, error: "Requisition not found" };
  if (pr.status !== "ORDERED") return { success: false, error: "Only an ordered requisition can be received." };

  await prisma.$transaction([
    prisma.purchaseRequisition.update({
      where: { id },
      data: { status: "RECEIVED", receivedAt: new Date() },
    }),
    prisma.purchaseRequisitionItem.updateMany({ where: { prId: id }, data: { received: true } }),
  ]);

  // Accrue the expense + payable in the GL (idempotent, best-effort — never
  // blocks the receipt if Finance isn't set up).
  await postPurchaseReceived(id, u.id).catch((e) =>
    console.error("[PROCUREMENT_GL_BRIDGE_ERROR]", e)
  );

  revalidatePath(`/procurement/${id}`);
  revalidatePath("/procurement");
  return { success: true, data: { id } };
}
