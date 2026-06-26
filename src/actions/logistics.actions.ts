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

// Booking statuses a dispatch may be linked to: committed events only.
// Excludes HOLD / TENTATIVE (not yet committed) and CANCELLED.
const DISPATCHABLE_BOOKING_STATUSES = [
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

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
  inventoryItemId: string | null;
}) {
  return {
    id: i.id,
    dispatchId: i.dispatchId,
    name: i.name,
    quantity: i.quantity,
    returnable: i.returnable,
    returnedQty: i.returnedQty,
    inventoryItemId: i.inventoryItemId,
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

// Active stock items for the optional per-line inventory link. Linking a line
// drives the auto stock-out on dispatch and stock-restore on return.
export async function getInventoryOptions(): Promise<
  Result<{ id: string; label: string; availableQty: number }[]>
> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const rows = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sku: true, availableQty: true },
    orderBy: { name: "asc" },
    take: 500,
  });
  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      label: `${r.name}${r.sku ? ` (${r.sku})` : ""} · ${r.availableQty} avail`,
      availableQty: r.availableQty,
    })),
  };
}

// ------------------------------------------------------------
// Create
// ------------------------------------------------------------
type ItemInput = { name: string; quantity: number; returnable: boolean; inventoryItemId?: string | null };

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
              inventoryItemId: it.inventoryItemId ?? null,
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
      inventoryItemId: it.inventoryItemId || null,
    }))
    .filter((it) => it.name.length > 0);
  if (items.length === 0)
    return { success: false, error: "Add at least one item to dispatch." };

  let scheduledAt: Date | null = null;
  if (input.scheduledAt) {
    const dt = new Date(input.scheduledAt);
    if (!Number.isNaN(dt.getTime())) scheduledAt = dt;
  }

  // Validate the optional booking link: the booking must exist AND be in a
  // committed status. Dispatching goods against a HOLD/TENTATIVE/CANCELLED
  // booking would link them to an event that may never happen. (IN_PROGRESS /
  // COMPLETED are allowed because dispatch/return happens around event time.)
  if (input.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: { status: true },
    });
    if (!booking) return { success: false, error: "Linked booking not found." };
    if (!(DISPATCHABLE_BOOKING_STATUSES as readonly string[]).includes(booking.status))
      return {
        success: false,
        error: "Only a confirmed booking can be linked to a dispatch.",
      };
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
      // Same guard as createDispatch: booking must exist AND be in a
      // committed (dispatchable) status.
      const booking = await prisma.booking.findUnique({
        where: { id: patch.bookingId },
        select: { status: true },
      });
      if (!booking) return { success: false, error: "Linked booking not found." };
      if (!(DISPATCHABLE_BOOKING_STATUSES as readonly string[]).includes(booking.status))
        return {
          success: false,
          error: "Only a confirmed booking can be linked to a dispatch.",
        };
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
      inventoryItemId: item.inventoryItemId || null,
    },
    select: { id: true },
  });
  revalidatePath(`/logistics/${dispatchId}`);
  return { success: true, data: { id: created.id } };
}

export async function updateDispatchItem(
  itemId: string,
  patch: { name?: string; quantity?: number; returnable?: boolean; inventoryItemId?: string | null },
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
  if (patch.inventoryItemId !== undefined) data.inventoryItemId = patch.inventoryItemId || null;

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
    select: { status: true, items: { select: { inventoryItemId: true, quantity: true } } },
  });
  if (!d) return { success: false, error: "Dispatch not found" };
  if (d.status !== "PLANNED")
    return {
      success: false,
      error: "Only a planned dispatch can be marked dispatched.",
    };

  // Move stock out for any line linked to an inventory item. The status flip is
  // a conditional updateMany INSIDE the txn (keyed on status=PLANNED), so two
  // concurrent calls can't both decrement — the loser sees count 0 and the txn
  // makes no stock change.
  //
  // We require availableQty >= quantity for EVERY linked line before decrementing.
  // Without this guard the decrement would silently clamp at 0 (fewer units leave
  // stock than the line claims), while return/cancel restore the full quantity —
  // inflating inventory above what physically left. Failing here keeps dispatch
  // and restore symmetric.
  // Aggregate per-inventory-item demand: the same item may appear on multiple
  // lines, so decrement the summed quantity in one atomic op per item.
  const demand = new Map<string, number>();
  for (const it of d.items) {
    if (!it.inventoryItemId) continue;
    demand.set(
      it.inventoryItemId,
      (demand.get(it.inventoryItemId) ?? 0) + it.quantity,
    );
  }

  let raced = false;
  let insufficient = false;
  let missing = false;
  await prisma
    .$transaction(async (tx) => {
      const flip = await tx.dispatchOrder.updateMany({
        where: { id, status: "PLANNED" },
        data: { status: "DISPATCHED", dispatchedAt: new Date() },
      });
      if (flip.count === 0) {
        raced = true;
        return;
      }
      // Atomic conditional decrement per linked inventory item. updateMany with
      // WHERE availableQty >= qty means two concurrent calls (or any concurrent
      // stock movement) can never drive availableQty negative: the request that
      // would over-draw matches 0 rows. We require the affected count to be 1;
      // 0 means either insufficient stock or the item was deleted — both abort
      // the whole transaction (rolling back the status flip), keeping dispatch
      // and the later return/cancel restore symmetric.
      for (const [inventoryItemId, qty] of demand) {
        const dec = await tx.inventoryItem.updateMany({
          where: { id: inventoryItemId, availableQty: { gte: qty } },
          data: { availableQty: { decrement: qty } },
        });
        if (dec.count === 1) continue;
        // Distinguish "item gone" from "not enough stock" for a clear message.
        const stillExists = await tx.inventoryItem.findUnique({
          where: { id: inventoryItemId },
          select: { id: true },
        });
        if (!stillExists) missing = true;
        else insufficient = true;
        throw new Error("STOCK_BLOCKED");
      }
    })
    .catch((e) => {
      if (insufficient || missing) return; // handled below
      throw e;
    });
  if (missing)
    return {
      success: false,
      error:
        "A linked inventory item no longer exists. Update the dispatch lines and try again.",
    };
  if (insufficient)
    return {
      success: false,
      error: "Not enough stock to dispatch one or more linked items.",
    };
  if (raced) return { success: false, error: "This dispatch was already marked dispatched." };
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

  let missingInventory = false;
  await prisma
    .$transaction(async (tx) => {
      for (const up of updates) {
        const item = byId.get(up.id)!;
        await tx.dispatchItem.update({
          where: { id: up.id },
          data: { returnedQty: up.returnedQty },
        });
        // Restore stock by the newly-returned delta (not the absolute total), so
        // repeated/partial return entries never over-credit the inventory.
        const delta = up.returnedQty - item.returnedQty;
        if (delta !== 0 && item.inventoryItemId) {
          // Re-read inside the txn against the CURRENT availableQty/totalQuantity
          // (both may have changed since this dispatch went out). If the linked
          // item was deleted between dispatch and return, do NOT silently skip
          // the restore — that would strand the returned units and leave stock
          // artificially low. Abort the whole return with a clear error instead.
          const inv = await tx.inventoryItem.findUnique({
            where: { id: item.inventoryItemId },
            select: { availableQty: true, totalQuantity: true },
          });
          if (!inv) {
            missingInventory = true;
            throw new Error("INVENTORY_MISSING");
          }
          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: {
              availableQty: Math.min(
                inv.totalQuantity,
                Math.max(0, inv.availableQty + delta),
              ),
            },
          });
        }
      }
    })
    .catch((e) => {
      if (missingInventory) return; // handled below
      throw e;
    });
  if (missingInventory)
    return {
      success: false,
      error:
        "A linked inventory item no longer exists, so its returned stock cannot be restored. Re-link or recreate the item, then record the return.",
    };

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
    select: {
      status: true,
      items: { select: { inventoryItemId: true, quantity: true, returnedQty: true } },
    },
  });
  if (!d) return { success: false, error: "Dispatch not found" };
  if (d.status !== "PLANNED" && d.status !== "DISPATCHED")
    return {
      success: false,
      error: "Only a planned or dispatched order can be cancelled.",
    };

  // If the order had already gone out (DISPATCHED), stock was decremented on
  // dispatch — cancelling means the goods didn't actually leave, so restore the
  // outstanding (not-yet-returned) quantity for each linked line. A conditional
  // updateMany keeps the flip+restore once-only. PLANNED orders never moved
  // stock, so there's nothing to restore.
  const wasDispatched = d.status === "DISPATCHED";
  await prisma.$transaction(async (tx) => {
    const flip = await tx.dispatchOrder.updateMany({
      where: { id, status: d.status },
      data: { status: "CANCELLED" },
    });
    if (flip.count === 0) return; // raced — someone else changed the status
    if (!wasDispatched) return;
    for (const it of d.items) {
      if (!it.inventoryItemId) continue;
      const outstanding = Math.max(0, it.quantity - it.returnedQty);
      if (outstanding === 0) continue;
      const inv = await tx.inventoryItem.findUnique({
        where: { id: it.inventoryItemId },
        select: { availableQty: true, totalQuantity: true },
      });
      if (!inv) continue;
      await tx.inventoryItem.update({
        where: { id: it.inventoryItemId },
        data: { availableQty: Math.min(inv.totalQuantity, inv.availableQty + outstanding) },
      });
    }
  });
  revalidatePath("/logistics");
  revalidatePath(`/logistics/${id}`);
  return { success: true, data: { id } };
}
