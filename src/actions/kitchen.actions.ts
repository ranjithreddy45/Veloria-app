"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ------------------------------------------------------------
// Auth helpers — kitchen:read for reads, kitchen:write for writes
// ------------------------------------------------------------
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

async function requireRead() {
  const u = await requireUser();
  if (!u) return { user: null, error: "Unauthorized" as const };
  if (!hasPermission(u.role ?? "", "kitchen:read"))
    return { user: null, error: "Not authorized" as const };
  return { user: u, error: null };
}

async function requireWrite() {
  const u = await requireUser();
  if (!u) return { user: null, error: "Unauthorized" as const };
  if (!hasPermission(u.role ?? "", "kitchen:write"))
    return { user: null, error: "Not authorized" as const };
  return { user: u, error: null };
}

// ------------------------------------------------------------
// Decimal-safe helpers — money is Decimal; do math on Number(),
// round to 2dp to avoid float drift, and store back as a number.
// ------------------------------------------------------------
const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
/** est food cost = Σ(quantity × estUnitCost), rounded to 2dp. */
function rollupEstFoodCost(items: { quantity: unknown; estUnitCost: unknown }[]): number {
  return round2(items.reduce((sum, it) => sum + num(it.quantity) * num(it.estUnitCost), 0));
}
/**
 * actual food cost = Σ(quantity × actualUnitCost), rounded to 2dp — but only
 * when at least one item has an actual unit cost entered. Returns null when no
 * per-item actuals exist, so the plan's manually-set actualFoodCost is left
 * untouched. Per-item actuals are authoritative once present.
 */
function rollupActualFoodCost(
  items: { quantity: unknown; actualUnitCost: unknown }[],
): number | null {
  const hasActuals = items.some((it) => it.actualUnitCost != null);
  if (!hasActuals) return null;
  return round2(
    items.reduce((sum, it) => sum + num(it.quantity) * num(it.actualUnitCost), 0),
  );
}
/** divide-by-zero guarded per-cover cost. */
function perCover(estFoodCost: number, covers: number): number {
  return covers > 0 ? round2(estFoodCost / covers) : 0;
}

// ------------------------------------------------------------
// DTOs — serialize Decimal→Number, Date→ISO
// ------------------------------------------------------------
export interface KitchenPlanItemDTO {
  id: string;
  planId: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  estUnitCost: number;
  actualUnitCost: number | null;
  lineTotal: number;
}

export interface KitchenPlanRowDTO {
  id: string;
  bookingId: string;
  beoId: string | null;
  covers: number;
  status: string;
  estFoodCost: number;
  actualFoodCost: number;
  perCoverCost: number;
  notes: string | null;
  itemCount: number;
  eventName: string | null;
  eventDate: string | null;
  perPlatePrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface KitchenPlanDTO extends KitchenPlanRowDTO {
  items: KitchenPlanItemDTO[];
  actualPerCoverCost: number;
  variance: number; // actual − est (₹); positive = over budget
}

function itemToDTO(it: {
  id: string;
  planId: string;
  name: string;
  category: string | null;
  quantity: unknown;
  unit: string | null;
  estUnitCost: unknown;
  actualUnitCost: unknown;
}): KitchenPlanItemDTO {
  const quantity = num(it.quantity);
  const estUnitCost = num(it.estUnitCost);
  return {
    id: it.id,
    planId: it.planId,
    name: it.name,
    category: it.category,
    quantity,
    unit: it.unit,
    estUnitCost,
    actualUnitCost: it.actualUnitCost == null ? null : num(it.actualUnitCost),
    lineTotal: round2(quantity * estUnitCost),
  };
}

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------
export async function getKitchenPlans(): Promise<Result<KitchenPlanRowDTO[]>> {
  const { error } = await requireRead();
  if (error) return { success: false, error };

  const plans = await prisma.kitchenPlan.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  // Resolve linked booking event name/date in one batch.
  const bookingIds = [...new Set(plans.map((p) => p.bookingId))];
  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    select: { id: true, eventName: true, date: true, perPlatePrice: true },
  });
  const byId = new Map(bookings.map((b) => [b.id, b]));

  const data = plans.map((p): KitchenPlanRowDTO => {
    const b = byId.get(p.bookingId);
    const estFoodCost = num(p.estFoodCost);
    return {
      id: p.id,
      bookingId: p.bookingId,
      beoId: p.beoId,
      covers: p.covers,
      status: p.status,
      estFoodCost,
      actualFoodCost: num(p.actualFoodCost),
      perCoverCost: perCover(estFoodCost, p.covers),
      notes: p.notes,
      itemCount: p._count.items,
      eventName: b?.eventName ?? null,
      eventDate: b?.date ? b.date.toISOString() : null,
      perPlatePrice: b?.perPlatePrice == null ? null : num(b.perPlatePrice),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  return { success: true, data };
}

export async function getKitchenPlan(id: string): Promise<Result<KitchenPlanDTO>> {
  const { error } = await requireRead();
  if (error) return { success: false, error };

  const p = await prisma.kitchenPlan.findUnique({
    where: { id },
    include: { items: { orderBy: { name: "asc" } } },
  });
  if (!p) return { success: false, error: "Kitchen plan not found" };

  const b = await prisma.booking.findUnique({
    where: { id: p.bookingId },
    select: { eventName: true, date: true, perPlatePrice: true },
  });

  const estFoodCost = num(p.estFoodCost);
  const actualFoodCost = num(p.actualFoodCost);
  const perCoverCost = perCover(estFoodCost, p.covers);

  return {
    success: true,
    data: {
      id: p.id,
      bookingId: p.bookingId,
      beoId: p.beoId,
      covers: p.covers,
      status: p.status,
      estFoodCost,
      actualFoodCost,
      perCoverCost,
      notes: p.notes,
      itemCount: p.items.length,
      eventName: b?.eventName ?? null,
      eventDate: b?.date ? b.date.toISOString() : null,
      perPlatePrice: b?.perPlatePrice == null ? null : num(b.perPlatePrice),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      items: p.items.map(itemToDTO),
      actualPerCoverCost: perCover(actualFoodCost, p.covers),
      variance: round2(actualFoodCost - estFoodCost),
    },
  };
}

export interface BookableEventDTO {
  id: string;
  label: string;
  eventName: string;
  eventDate: string | null;
  guestCount: number;
  perPlatePrice: number | null;
}

/** Confirmed bookings for the new-plan picker. */
export async function getBookableEvents(): Promise<Result<BookableEventDTO[]>> {
  const { error } = await requireRead();
  if (error) return { success: false, error };

  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
    orderBy: { date: "asc" },
    select: {
      id: true,
      bookingNumber: true,
      eventName: true,
      date: true,
      guestCount: true,
      perPlatePrice: true,
    },
  });

  return {
    success: true,
    data: bookings.map((b) => ({
      id: b.id,
      label: `${b.eventName} · ${b.bookingNumber}`,
      eventName: b.eventName,
      eventDate: b.date ? b.date.toISOString() : null,
      guestCount: b.guestCount,
      perPlatePrice: b.perPlatePrice == null ? null : num(b.perPlatePrice),
    })),
  };
}

// ------------------------------------------------------------
// Writes
// ------------------------------------------------------------
export async function createKitchenPlan(input: {
  bookingId: string;
  covers?: number;
}): Promise<Result<{ id: string }>> {
  const { user, error } = await requireWrite();
  if (error) return { success: false, error };

  if (!input.bookingId) return { success: false, error: "Select an event" };

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, guestCount: true },
  });
  if (!booking) return { success: false, error: "Booking not found" };

  // Prefill covers from booking guestCount when not supplied.
  const covers =
    input.covers != null && input.covers > 0
      ? Math.floor(input.covers)
      : booking.guestCount ?? 0;

  // Auto-link to the booking's Function Sheet (BEO) if one exists, so the
  // kitchen plan and the run-of-show are tied to the same event.
  const beo = await prisma.beo.findFirst({
    where: { bookingId: booking.id },
    select: { id: true },
  });

  const created = await prisma.kitchenPlan.create({
    data: {
      bookingId: booking.id,
      beoId: beo?.id ?? null,
      covers,
      status: "PLANNED",
      estFoodCost: 0,
      actualFoodCost: 0,
      createdById: user!.id,
    },
    select: { id: true },
  });

  revalidatePath("/kitchen");
  return { success: true, data: { id: created.id } };
}

const VALID_STATUS = new Set(["PLANNED", "IN_PROGRESS", "COMPLETED"]);

export async function updateKitchenPlan(
  id: string,
  patch: { covers?: number; status?: string; notes?: string; actualFoodCost?: number },
): Promise<Result<{ id: string }>> {
  const { error } = await requireWrite();
  if (error) return { success: false, error };

  const plan = await prisma.kitchenPlan.findUnique({ where: { id }, select: { id: true } });
  if (!plan) return { success: false, error: "Kitchen plan not found" };

  const data: Record<string, unknown> = {};
  if (patch.covers != null) {
    if (patch.covers < 0) return { success: false, error: "Covers cannot be negative" };
    data.covers = Math.floor(patch.covers);
  }
  if (patch.status != null) {
    if (!VALID_STATUS.has(patch.status)) return { success: false, error: "Invalid status" };
    data.status = patch.status;
  }
  if (patch.notes !== undefined) data.notes = patch.notes || null;
  if (patch.actualFoodCost != null) {
    if (patch.actualFoodCost < 0) return { success: false, error: "Actual food cost cannot be negative" };
    data.actualFoodCost = round2(patch.actualFoodCost);
  }

  if (Object.keys(data).length === 0) return { success: true, data: { id } };

  await prisma.kitchenPlan.update({ where: { id }, data });
  revalidatePath(`/kitchen/${id}`);
  revalidatePath("/kitchen");
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Item CRUD — each mutation recomputes & persists the rollup.
// ------------------------------------------------------------
/**
 * Recompute estFoodCost = Σ(quantity×estUnitCost) from current items and store
 * on the plan. When any item has an actualUnitCost entered, per-item actuals are
 * authoritative: also roll them up into actualFoodCost = Σ(quantity×actualUnitCost)
 * so the plan's actual cost and variance stay reconciled with the entered actuals.
 * When no per-item actuals exist, the manually-set actualFoodCost is left untouched.
 */
async function recomputeRollup(planId: string) {
  const items = await prisma.kitchenPlanItem.findMany({
    where: { planId },
    select: { quantity: true, estUnitCost: true, actualUnitCost: true },
  });
  const estFoodCost = rollupEstFoodCost(items);
  const actualFoodCost = rollupActualFoodCost(items);
  const data: Record<string, unknown> = { estFoodCost };
  if (actualFoodCost != null) data.actualFoodCost = actualFoodCost;
  await prisma.kitchenPlan.update({ where: { id: planId }, data });
}

export async function addPlanItem(
  planId: string,
  item: {
    name: string;
    category?: string;
    quantity: number;
    unit?: string;
    estUnitCost: number;
  },
): Promise<Result<{ id: string }>> {
  const { error } = await requireWrite();
  if (error) return { success: false, error };

  const plan = await prisma.kitchenPlan.findUnique({ where: { id: planId }, select: { id: true } });
  if (!plan) return { success: false, error: "Kitchen plan not found" };

  if (!item.name?.trim()) return { success: false, error: "Ingredient name is required" };
  if (item.quantity < 0 || item.estUnitCost < 0)
    return { success: false, error: "Quantity and unit cost cannot be negative" };

  const created = await prisma.kitchenPlanItem.create({
    data: {
      planId,
      name: item.name.trim(),
      category: item.category?.trim() || null,
      quantity: round2(item.quantity),
      unit: item.unit?.trim() || null,
      estUnitCost: round2(item.estUnitCost),
    },
    select: { id: true },
  });

  await recomputeRollup(planId);
  revalidatePath(`/kitchen/${planId}`);
  revalidatePath("/kitchen");
  return { success: true, data: { id: created.id } };
}

export async function updatePlanItem(
  itemId: string,
  patch: {
    name?: string;
    category?: string;
    quantity?: number;
    unit?: string;
    estUnitCost?: number;
    actualUnitCost?: number | null;
  },
): Promise<Result<{ id: string }>> {
  const { error } = await requireWrite();
  if (error) return { success: false, error };

  const existing = await prisma.kitchenPlanItem.findUnique({
    where: { id: itemId },
    select: { id: true, planId: true },
  });
  if (!existing) return { success: false, error: "Ingredient not found" };

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) return { success: false, error: "Ingredient name is required" };
    data.name = patch.name.trim();
  }
  if (patch.category !== undefined) data.category = patch.category?.trim() || null;
  if (patch.unit !== undefined) data.unit = patch.unit?.trim() || null;
  if (patch.quantity != null) {
    if (patch.quantity < 0) return { success: false, error: "Quantity cannot be negative" };
    data.quantity = round2(patch.quantity);
  }
  if (patch.estUnitCost != null) {
    if (patch.estUnitCost < 0) return { success: false, error: "Unit cost cannot be negative" };
    data.estUnitCost = round2(patch.estUnitCost);
  }
  if (patch.actualUnitCost !== undefined) {
    data.actualUnitCost =
      patch.actualUnitCost == null ? null : round2(patch.actualUnitCost);
  }

  if (Object.keys(data).length > 0) {
    await prisma.kitchenPlanItem.update({ where: { id: itemId }, data });
  }
  await recomputeRollup(existing.planId);
  revalidatePath(`/kitchen/${existing.planId}`);
  revalidatePath("/kitchen");
  return { success: true, data: { id: itemId } };
}

export async function deletePlanItem(itemId: string): Promise<Result<{ id: string }>> {
  const { error } = await requireWrite();
  if (error) return { success: false, error };

  const existing = await prisma.kitchenPlanItem.findUnique({
    where: { id: itemId },
    select: { id: true, planId: true },
  });
  if (!existing) return { success: false, error: "Ingredient not found" };

  await prisma.kitchenPlanItem.delete({ where: { id: itemId } });
  await recomputeRollup(existing.planId);
  revalidatePath(`/kitchen/${existing.planId}`);
  revalidatePath("/kitchen");
  return { success: true, data: { id: itemId } };
}
