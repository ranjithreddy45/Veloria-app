"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { assertTransition } from "@/lib/ops/state-machine";
import { postPurchaseReceivedWithinTx } from "@/lib/finance/procurement";

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
// Internal: sum line items -> totalAmount (2-dp rounded)
// ------------------------------------------------------------
function sumItems(items: { quantity: Prisma.Decimal | number; unitPrice: Prisma.Decimal | number }[]): number {
  return Math.round(
    items.reduce((acc, it) => acc + dec(it.quantity as Prisma.Decimal) * dec(it.unitPrice as Prisma.Decimal), 0) * 100,
  ) / 100;
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

  // Link to the per-booking EventOperation aggregate root if one exists.
  const op = input.bookingId
    ? await prisma.eventOperation.findUnique({ where: { bookingId: input.bookingId }, select: { id: true } })
    : null;

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
          operationId: op?.id ?? null,
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

// Item-level CRUD (add/update/delete a single line item) was removed: no UI
// component called it, line items are created/edited via createPurchaseRequisition
// at creation time, and an unused-but-exported server action is an unnecessary
// surface. Reintroduce alongside detail-page inline editing if that ships.

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
  const approveGate = assertTransition("procurement", pr.status, "APPROVED");
  if (!approveGate.ok) return { success: false, error: approveGate.error! };
  // Maker-checker: you can't approve your own requisition — except SUPER_ADMIN,
  // who is never gated by the approval process.
  if (pr.requestedById === u.id && u.role !== "SUPER_ADMIN") {
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
  const rejectGate = assertTransition("procurement", pr.status, "REJECTED");
  if (!rejectGate.ok) return { success: false, error: rejectGate.error! };

  const trimmed = reason?.trim();
  const notes = trimmed
    ? `${pr.notes ? `${pr.notes}\n\n` : ""}Rejected: ${trimmed}`
    : pr.notes;

  // Rejection is not an approval: don't stamp approvedById/approvedAt (the
  // schema has no rejectedAt field). Record the rejector in the notes trail
  // above and leave the approval columns untouched.
  await prisma.purchaseRequisition.update({
    where: { id },
    data: { status: "REJECTED", notes },
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
  const orderGate = assertTransition("procurement", pr.status, "ORDERED");
  if (!orderGate.ok) return { success: false, error: orderGate.error! };

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
  const receiveGate = assertTransition("procurement", pr.status, "RECEIVED");
  if (!receiveGate.ok) return { success: false, error: receiveGate.error! };

  // Receipt + GL accrual in ONE transaction so they're durable together: an
  // unexpected GL failure rolls the receipt back (user retries) instead of
  // leaving a RECEIVED PR with no journal entry. Expected non-posts (Finance
  // not seeded yet, already posted) return gracefully and the receipt commits.
  // The status flip is a conditional updateMany (keyed on status=ORDERED) INSIDE
  // the txn, so two concurrent receives can't both proceed — the loser sees
  // count 0 and rolls back without touching items or the GL.
  let raced = false;
  try {
    await prisma.$transaction(async (tx) => {
      const flip = await tx.purchaseRequisition.updateMany({
        where: { id, status: "ORDERED" },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });
      if (flip.count === 0) {
        raced = true;
        return;
      }
      await tx.purchaseRequisitionItem.updateMany({ where: { prId: id }, data: { received: true } });
      await postPurchaseReceivedWithinTx(tx, id, u.id);
    });
  } catch (e) {
    console.error("[PROCUREMENT_RECEIVE_ERROR]", e);
    return { success: false, error: "Could not record the receipt. Please retry." };
  }
  if (raced) return { success: false, error: "This requisition was already received." };

  revalidatePath(`/procurement/${id}`);
  revalidatePath("/procurement");
  return { success: true, data: { id } };
}
