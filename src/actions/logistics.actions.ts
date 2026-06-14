"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// ============================================================
// Logistics / equipment-dispatch server actions.
// Reads require logistics:read, writes require logistics:write.
// All Date fields are serialized to ISO strings for the client.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

export type DispatchStatus =
  | "PLANNED"
  | "DISPATCHED"
  | "DELIVERED"
  | "RETURNED"
  | "CANCELLED";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

const canRead = (r?: string) => !!r && hasPermission(r, "logistics:read");
const canWrite = (r?: string) => !!r && hasPermission(r, "logistics:write");

// ------------------------------------------------------------
// DTOs / serialization
// ------------------------------------------------------------
function itemDTO(i: {
  id: string;
  dispatchId: string;
  name: string;
  quantity: number;
  returnable: boolean;
  returnedQty: number;
}) {
  return {
    id: i.id,
    dispatchId: i.dispatchId,
    name: i.name,
    quantity: i.quantity,
    returnable: i.returnable,
    returnedQty: i.returnedQty,
  };
}

function dispatchDTO(
  d: {
    id: string;
    dispatchNumber: string;
    bookingId: string | null;
    status: string;
    fromLocation: string | null;
    toLocation: string | null;
    scheduledAt: Date | null;
    dispatchedAt: Date | null;
    deliveredAt: Date | null;
    returnedAt: Date | null;
    driverName: string | null;
    vehicleNo: string | null;
    notes: string | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    items?: Parameters<typeof itemDTO>[0][];
  },
  event?: { name: string; date: string | null } | null,
) {
  return {
    id: d.id,
    dispatchNumber: d.dispatchNumber,
    bookingId: d.bookingId,
    status: d.status as DispatchStatus,
    fromLocation: d.fromLocation,
    toLocation: d.toLocation,
    scheduledAt: d.scheduledAt?.toISOString() ?? null,
    dispatchedAt: d.dispatchedAt?.toISOString() ?? null,
    deliveredAt: d.deliveredAt?.toISOString() ?? null,
    returnedAt: d.returnedAt?.toISOString() ?? null,
    driverName: d.driverName,
    vehicleNo: d.vehicleNo,
    notes: d.notes,
    createdById: d.createdById,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    eventName: event?.name ?? null,
    eventDate: event?.date ?? null,
    items: (d.items ?? []).map(itemDTO),
  };
}

export type DispatchDTO = ReturnType<typeof dispatchDTO>;
export type DispatchItemDTO = ReturnType<typeof itemDTO>;

// Resolve linked-booking event metadata for a set of dispatches in one query.
async function resolveEvents(
  bookingIds: string[],
): Promise<Map<string, { name: string; date: string | null }>> {
  const ids = [...new Set(bookingIds.filter(Boolean))];
  const map = new Map<string, { name: string; date: string | null }>();
  if (ids.length === 0) return map;
  const bookings = await prisma.booking.findMany({
    where: { id: { in: ids } },
    select: { id: true, eventName: true, date: true },
  });
  for (const b of bookings) {
    map.set(b.id, { name: b.eventName, date: b.date?.toISOString() ?? null });
  }
  return map;
}

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------
export async function getDispatches(opts?: {
  status?: DispatchStatus;
}): Promise<Result<DispatchDTO[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;

  const rows = await prisma.dispatchOrder.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
  });
  const events = await resolveEvents(
    rows.map((r) => r.bookingId).filter((x): x is string => !!x),
  );
  return {
    success: true,
    data: rows.map((r) =>
      dispatchDTO(r, r.bookingId ? events.get(r.bookingId) ?? null : null),
    ),
  };
}

export async function getDispatch(id: string): Promise<Result<DispatchDTO>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const d = await prisma.dispatchOrder.findUnique({
    where: { id },
    include: { items: { orderBy: { name: "asc" } } },
  });
  if (!d) return { success: false, error: "Dispatch not found" };

  let event: { name: string; date: string | null } | null = null;
  if (d.bookingId) {
    const b = await prisma.booking.findUnique({
      where: { id: d.bookingId },
      select: { eventName: true, date: true },
    });
    if (b) event = { name: b.eventName, date: b.date?.toISOString() ?? null };
  }
  return { success: true, data: dispatchDTO(d, event) };
}

// Confirmed bookings for the optional booking picker on the create dialog.
export async function getBookableEvents(): Promise<
  Result<{ id: string; label: string; date: string | null }[]>
> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const rows = await prisma.booking.findMany({
    where: { status: "CONFIRMED" },
    select: {
      id: true,
      bookingNumber: true,
      eventName: true,
      date: true,
      venue: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }],
    take: 200,
  });
  return {
    success: true,
    data: rows.map((b) => ({
      id: b.id,
      label: `${b.bookingNumber} · ${b.eventName}${b.venue?.name ? ` · ${b.venue.name}` : ""}`,
      date: b.date?.toISOString() ?? null,
    })),
  };
}

// ------------------------------------------------------------
// Create
// ------------------------------------------------------------
type ItemInput = { name: string; quantity: number; returnable: boolean };

// Allocate the next DSP-YYYY-NNN number via count()+1, with a P2002 retry loop
// so concurrent creates don't collide on the @unique dispatchNumber.
async function createWithNumber(
  data: Omit<
    Parameters<typeof prisma.dispatchOrder.create>[0]["data"],
    "dispatchNumber" | "items"
  >,
  items: ItemInput[],
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DSP-${year}-`;

  // Seed the sequence from the current count of this year's dispatches.
  let seq =
    (await prisma.dispatchOrder.count({
      where: { dispatchNumber: { startsWith: prefix } },
    })) + 1;

  for (let attempt = 0; attempt < 25; attempt++) {
    const dispatchNumber = `${prefix}${String(seq).padStart(3, "0")}`;
    try {
      const created = await prisma.dispatchOrder.create({
        data: {
          ...data,
          dispatchNumber,
          items: {
            create: items.map((it) => ({
              name: it.name,
              quantity: it.quantity,
              returnable: it.returnable,
            })),
          },
        },
        select: { id: true },
      });
      return created.id;
    } catch (err: unknown) {
      // P2002 = unique constraint failed → bump the sequence and retry.
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        seq++;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not allocate a unique dispatch number. Try again.");
}

export async function createDispatch(input: {
  bookingId?: string;
  fromLocation?: string;
  toLocation?: string;
  scheduledAt?: string;
  driverName?: string;
  vehicleNo?: string;
  notes?: string;
  items: ItemInput[];
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const items = (input.items ?? [])
    .map((it) => ({
      name: (it.name ?? "").trim(),
      quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
      returnable: !!it.returnable,
    }))
    .filter((it) => it.name.length > 0);
  if (items.length === 0)
    return { success: false, error: "Add at least one item to dispatch." };

  let scheduledAt: Date | null = null;
  if (input.scheduledAt) {
    const dt = new Date(input.scheduledAt);
    if (!Number.isNaN(dt.getTime())) scheduledAt = dt;
  }

  // Validate the optional booking link.
  if (input.bookingId) {
    const exists = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: { id: true },
    });
    if (!exists) return { success: false, error: "Linked booking not found." };
  }

  const id = await createWithNumber(
    {
      bookingId: input.bookingId || null,
      status: "PLANNED",
      fromLocation: input.fromLocation?.trim() || null,
      toLocation: input.toLocation?.trim() || null,
      scheduledAt,
      driverName: input.driverName?.trim() || null,
      vehicleNo: input.vehicleNo?.trim() || null,
      notes: input.notes?.trim() || null,
      createdById: u.id,
    },
    items,
  );

  revalidatePath("/logistics");
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Update (only while PLANNED) + item CRUD
// ------------------------------------------------------------
export async function updateDispatch(
  id: string,
  patch: {
    bookingId?: string | null;
    fromLocation?: string | null;
    toLocation?: string | null;
    scheduledAt?: string | null;
    driverName?: string | null;
    vehicleNo?: string | null;
    notes?: string | null;
  },
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const d = await prisma.dispatchOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!d) return { success: false, error: "Dispatch not found" };
  if (d.status !== "PLANNED")
    return { success: false, error: "Only a planned dispatch can be edited." };

  const data: Record<string, unknown> = {};
  if ("bookingId" in patch) {
    if (patch.bookingId) {
      const exists = await prisma.booking.findUnique({
        where: { id: patch.bookingId },
        select: { id: true },
      });
      if (!exists) return { success: false, error: "Linked booking not found." };
      data.bookingId = patch.bookingId;
    } else {
      data.bookingId = null;
    }
  }
  if ("fromLocation" in patch) data.fromLocation = patch.fromLocation?.trim() || null;
  if ("toLocation" in patch) data.toLocation = patch.toLocation?.trim() || null;
  if ("driverName" in patch) data.driverName = patch.driverName?.trim() || null;
  if ("vehicleNo" in patch) data.vehicleNo = patch.vehicleNo?.trim() || null;
  if ("notes" in patch) data.notes = patch.notes?.trim() || null;
  if ("scheduledAt" in patch) {
    if (patch.scheduledAt) {
      const dt = new Date(patch.scheduledAt);
      data.scheduledAt = Number.isNaN(dt.getTime()) ? null : dt;
    } else {
      data.scheduledAt = null;
    }
  }

  await prisma.dispatchOrder.update({ where: { id }, data });
  revalidatePath("/logistics");
  revalidatePath(`/logistics/${id}`);
  return { success: true, data: { id } };
}

export async function addDispatchItem(
  dispatchId: string,
  item: ItemInput,
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const d = await prisma.dispatchOrder.findUnique({
    where: { id: dispatchId },
    select: { status: true },
  });
  if (!d) return { success: false, error: "Dispatch not found" };
  if (d.status !== "PLANNED")
    return { success: false, error: "Items can only change while planned." };

  const name = (item.name ?? "").trim();
  if (!name) return { success: false, error: "Item name is required." };

  const created = await prisma.dispatchItem.create({
    data: {
      dispatchId,
      name,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      returnable: !!item.returnable,
    },
    select: { id: true },
  });
  revalidatePath(`/logistics/${dispatchId}`);
  return { success: true, data: { id: created.id } };
}

export async function updateDispatchItem(
  itemId: string,
  patch: { name?: string; quantity?: number; returnable?: boolean },
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const item = await prisma.dispatchItem.findUnique({
    where: { id: itemId },
    select: { id: true, dispatchId: true, dispatch: { select: { status: true } } },
  });
  if (!item) return { success: false, error: "Item not found" };
  if (item.dispatch.status !== "PLANNED")
    return { success: false, error: "Items can only change while planned." };

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return { success: false, error: "Item name is required." };
    data.name = name;
  }
  if (patch.quantity !== undefined)
    data.quantity = Math.max(1, Math.floor(Number(patch.quantity) || 1));
  if (patch.returnable !== undefined) data.returnable = !!patch.returnable;

  await prisma.dispatchItem.update({ where: { id: itemId }, data });
  revalidatePath(`/logistics/${item.dispatchId}`);
  return { success: true, data: { id: itemId } };
}

export async function removeDispatchItem(
  itemId: string,
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const item = await prisma.dispatchItem.findUnique({
    where: { id: itemId },
    select: { id: true, dispatchId: true, dispatch: { select: { status: true } } },
  });
  if (!item) return { success: false, error: "Item not found" };
  if (item.dispatch.status !== "PLANNED")
    return { success: false, error: "Items can only change while planned." };

  await prisma.dispatchItem.delete({ where: { id: itemId } });
  revalidatePath(`/logistics/${item.dispatchId}`);
  return { success: true, data: { id: itemId } };
}

// ------------------------------------------------------------
// Lifecycle — guarded transitions
// ------------------------------------------------------------
async function loadForTransition(id: string) {
  return prisma.dispatchOrder.findUnique({
    where: { id },
    include: { items: true },
  });
}

export async function markDispatched(
  id: string,
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const d = await prisma.dispatchOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!d) return { success: false, error: "Dispatch not found" };
  if (d.status !== "PLANNED")
    return {
      success: false,
      error: "Only a planned dispatch can be marked dispatched.",
    };

  await prisma.dispatchOrder.update({
    where: { id },
    data: { status: "DISPATCHED", dispatchedAt: new Date() },
  });
  revalidatePath("/logistics");
  revalidatePath(`/logistics/${id}`);
  return { success: true, data: { id } };
}

export async function markDelivered(
  id: string,
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const d = await prisma.dispatchOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!d) return { success: false, error: "Dispatch not found" };
  if (d.status !== "DISPATCHED")
    return {
      success: false,
      error: "Only a dispatched order can be marked delivered.",
    };

  await prisma.dispatchOrder.update({
    where: { id },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
  revalidatePath("/logistics");
  revalidatePath(`/logistics/${id}`);
  return { success: true, data: { id } };
}

// Record returned quantities per item. Each returnedQty is clamped to
// [0, item.quantity]. When every returnable item is fully returned, the
// dispatch transitions DELIVERED → RETURNED with returnedAt stamped.
export async function recordReturn(
  id: string,
  returns: { itemId: string; returnedQty: number }[],
): Promise<Result<{ id: string; status: DispatchStatus }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const d = await loadForTransition(id);
  if (!d) return { success: false, error: "Dispatch not found" };
  if (d.status !== "DELIVERED" && d.status !== "RETURNED")
    return {
      success: false,
      error: "Returns can only be recorded after delivery.",
    };

  const byId = new Map(d.items.map((it) => [it.id, it]));
  const updates: { id: string; returnedQty: number }[] = [];
  for (const r of returns) {
    const item = byId.get(r.itemId);
    if (!item) continue; // ignore unknown / foreign items
    const clamped = Math.max(0, Math.min(item.quantity, Math.floor(Number(r.returnedQty) || 0)));
    updates.push({ id: item.id, returnedQty: clamped });
  }

  // Apply updates, then re-evaluate completion against the persisted state.
  const newQty = new Map(d.items.map((it) => [it.id, it.returnedQty]));
  for (const up of updates) newQty.set(up.id, up.returnedQty);

  await prisma.$transaction([
    ...updates.map((up) =>
      prisma.dispatchItem.update({
        where: { id: up.id },
        data: { returnedQty: up.returnedQty },
      }),
    ),
  ]);

  // All returnable items fully returned? (non-returnable items are ignored)
  const returnable = d.items.filter((it) => it.returnable);
  const allReturned =
    returnable.length > 0 &&
    returnable.every((it) => (newQty.get(it.id) ?? 0) >= it.quantity);

  let status = d.status as DispatchStatus;
  if (allReturned && d.status !== "RETURNED") {
    await prisma.dispatchOrder.update({
      where: { id },
      data: { status: "RETURNED", returnedAt: new Date() },
    });
    status = "RETURNED";
  }

  revalidatePath("/logistics");
  revalidatePath(`/logistics/${id}`);
  return { success: true, data: { id, status } };
}

export async function cancelDispatch(
  id: string,
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const d = await prisma.dispatchOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!d) return { success: false, error: "Dispatch not found" };
  if (d.status !== "PLANNED" && d.status !== "DISPATCHED")
    return {
      success: false,
      error: "Only a planned or dispatched order can be cancelled.",
    };

  await prisma.dispatchOrder.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/logistics");
  revalidatePath(`/logistics/${id}`);
  return { success: true, data: { id } };
}
