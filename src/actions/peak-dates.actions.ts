"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import {
  peakDateSchema,
  peakDateUpdateSchema,
  bulkPeakDateSchema,
  demandConfigSchema,
  type PeakDateInput,
  type PeakDateUpdateInput,
  type BulkPeakDateInput,
  type DemandConfigInput,
} from "@/schemas/peak-date.schema";
import {
  classifyDateDemand,
  type DemandConfig,
  type PeakDateInfo,
} from "@/lib/pricing/date-demand";
import { getDemandConfig } from "@/actions/date-demand.actions";

// ============================================================
// Date-Demand Pricing — Peak-date calendar + config admin actions.
// ------------------------------------------------------------
// Reads gated on "pricing:read"; writes on "pricing:manage" (the same keys the
// rest of /pricing uses — there is no "pricing:write" in permissions.ts).
// Dates are @db.Date: a "YYYY-MM-DD" string is parsed to UTC-midnight with
// new Date(Date.UTC(y, m-1, d)) so it matches every other date in the app.
// ============================================================

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, string[] | undefined> };

async function requireRead(): Promise<{ id: string; role: string } | null> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return null;
  if (!hasPermission(user.role ?? "", "pricing:read")) return null;
  return { id: user.id, role: user.role ?? "" };
}

async function requireWrite(): Promise<{ id: string; role: string } | null> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return null;
  if (!hasPermission(user.role ?? "", "pricing:manage")) return null;
  return { id: user.id, role: user.role ?? "" };
}

/** "YYYY-MM-DD" → UTC-midnight Date for an @db.Date column. */
function dateKeyToUtc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** @db.Date (UTC-midnight) → "YYYY-MM-DD". */
function utcToDateKey(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export interface PeakDateRow {
  id: string;
  date: string; // "YYYY-MM-DD"
  type: string;
  label: string;
  premiumPct: number | null;
  venueId: string | null;
  venueName: string | null;
  isActive: boolean;
  note: string | null;
}

// ------------------------------------------------------------
// List peak dates in an optional [from,to] window (inclusive), newest-day last.
// ------------------------------------------------------------
export async function listPeakDates(params?: {
  from?: string;
  to?: string;
}): Promise<Result<PeakDateRow[]>> {
  const user = await requireRead();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const where: { date?: { gte?: Date; lte?: Date } } = {};
    if (params?.from || params?.to) {
      where.date = {};
      if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from))
        where.date.gte = dateKeyToUtc(params.from);
      if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to))
        where.date.lte = dateKeyToUtc(params.to);
    }

    const rows = await prisma.peakDate.findMany({
      where,
      orderBy: [{ date: "asc" }, { type: "asc" }],
      take: 1000,
    });

    // Hydrate venue names (peak dates can be venue-specific or all-venues).
    const venueIds = Array.from(
      new Set(rows.map((r) => r.venueId).filter((v): v is string => Boolean(v)))
    );
    const venues = venueIds.length
      ? await prisma.venue.findMany({
          where: { id: { in: venueIds } },
          select: { id: true, name: true },
        })
      : [];
    const venueName = new Map(venues.map((v) => [v.id, v.name]));

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        date: utcToDateKey(r.date),
        type: r.type,
        label: r.label,
        premiumPct: r.premiumPct,
        venueId: r.venueId,
        venueName: r.venueId ? venueName.get(r.venueId) ?? "Unknown venue" : null,
        isActive: r.isActive,
        note: r.note,
      })),
    };
  } catch (e) {
    console.error("[LIST_PEAK_DATES_ERROR]", e);
    return { success: false, error: "Failed to load peak dates" };
  }
}

// ------------------------------------------------------------
// Create a single peak date.
// ------------------------------------------------------------
export async function createPeakDate(
  input: PeakDateInput
): Promise<Result<{ id: string }>> {
  const user = await requireWrite();
  if (!user) return { success: false, error: "Unauthorized" };

  const parsed = peakDateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  try {
    const row = await prisma.peakDate.create({
      data: {
        date: dateKeyToUtc(d.date),
        type: d.type,
        label: d.label,
        premiumPct: d.premiumPct ?? null,
        venueId: d.venueId ?? null,
        isActive: d.isActive,
        note: d.note ?? null,
        createdById: user.id,
      },
    });

    await logActivity({
      userId: user.id,
      action: "created",
      entityType: "PeakDate",
      entityId: row.id,
    });

    revalidatePath("/pricing/demand");
    return { success: true, data: { id: row.id } };
  } catch (e) {
    console.error("[CREATE_PEAK_DATE_ERROR]", e);
    return { success: false, error: "Failed to create peak date" };
  }
}

// ------------------------------------------------------------
// Update an existing peak date (partial).
// ------------------------------------------------------------
export async function updatePeakDate(
  id: string,
  input: PeakDateUpdateInput
): Promise<Result<{ id: string }>> {
  const user = await requireWrite();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!id) return { success: false, error: "Missing id" };

  const parsed = peakDateUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  try {
    const existing = await prisma.peakDate.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Peak date not found" };

    await prisma.peakDate.update({
      where: { id },
      data: {
        ...(d.date !== undefined ? { date: dateKeyToUtc(d.date) } : {}),
        ...(d.type !== undefined ? { type: d.type } : {}),
        ...(d.label !== undefined ? { label: d.label } : {}),
        ...(d.premiumPct !== undefined ? { premiumPct: d.premiumPct ?? null } : {}),
        ...(d.venueId !== undefined ? { venueId: d.venueId ?? null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.note !== undefined ? { note: d.note ?? null } : {}),
      },
    });

    await logActivity({
      userId: user.id,
      action: "updated",
      entityType: "PeakDate",
      entityId: id,
    });

    revalidatePath("/pricing/demand");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[UPDATE_PEAK_DATE_ERROR]", e);
    return { success: false, error: "Failed to update peak date" };
  }
}

// ------------------------------------------------------------
// Delete a peak date.
// ------------------------------------------------------------
export async function deletePeakDate(id: string): Promise<Result<{ id: string }>> {
  const user = await requireWrite();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!id) return { success: false, error: "Missing id" };

  try {
    const existing = await prisma.peakDate.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Peak date not found" };

    await prisma.peakDate.delete({ where: { id } });

    await logActivity({
      userId: user.id,
      action: "deleted",
      entityType: "PeakDate",
      entityId: id,
    });

    revalidatePath("/pricing/demand");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[DELETE_PEAK_DATE_ERROR]", e);
    return { success: false, error: "Failed to delete peak date" };
  }
}

// ------------------------------------------------------------
// Bulk-create (paste a year's Muhurtham dates at once). Skips exact duplicate
// (date, venueId, type) rows already present so re-pasting is idempotent.
// ------------------------------------------------------------
export async function bulkCreatePeakDates(
  input: BulkPeakDateInput
): Promise<Result<{ created: number; skipped: number }>> {
  const user = await requireWrite();
  if (!user) return { success: false, error: "Unauthorized" };

  const parsed = bulkPeakDateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    };
  }
  const { type, premiumPct, venueId, rows } = parsed.data;
  const venue = venueId ?? null;

  try {
    // De-dupe within the paste itself (same date) — keep first label.
    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      if (seen.has(r.date)) return false;
      seen.add(r.date);
      return true;
    });

    // Skip dates that already exist for this (type, venue).
    const existing = await prisma.peakDate.findMany({
      where: {
        type,
        venueId: venue,
        date: { in: unique.map((r) => dateKeyToUtc(r.date)) },
      },
      select: { date: true },
    });
    const existingKeys = new Set(existing.map((e) => utcToDateKey(e.date)));

    const toCreate = unique.filter((r) => !existingKeys.has(r.date));

    if (toCreate.length > 0) {
      await prisma.peakDate.createMany({
        data: toCreate.map((r) => ({
          date: dateKeyToUtc(r.date),
          type,
          label: r.label?.trim() || defaultLabelForType(type),
          premiumPct: premiumPct ?? null,
          venueId: venue,
          isActive: true,
          createdById: user.id,
        })),
      });
    }

    await logActivity({
      userId: user.id,
      action: "created",
      entityType: "PeakDate",
      entityId: `bulk:${toCreate.length}`,
    });

    revalidatePath("/pricing/demand");
    return {
      success: true,
      data: { created: toCreate.length, skipped: unique.length - toCreate.length },
    };
  } catch (e) {
    console.error("[BULK_CREATE_PEAK_DATES_ERROR]", e);
    return { success: false, error: "Failed to bulk-create peak dates" };
  }
}

function defaultLabelForType(type: string): string {
  if (type === "MUHURTHAM") return "Muhurtham date";
  if (type === "FESTIVAL") return "Festival date";
  return "Peak date";
}

// ------------------------------------------------------------
// Upsert the singleton DemandPricingConfig row.
// ------------------------------------------------------------
export async function updateDemandConfig(
  input: DemandConfigInput
): Promise<Result<DemandConfig>> {
  const user = await requireWrite();
  if (!user) return { success: false, error: "Unauthorized" };

  const parsed = demandConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    };
  }
  const c = parsed.data;

  try {
    const existing = await prisma.demandPricingConfig.findFirst({
      select: { id: true },
    });
    const row = existing
      ? await prisma.demandPricingConfig.update({
          where: { id: existing.id },
          data: c,
        })
      : await prisma.demandPricingConfig.create({ data: c });

    await logActivity({
      userId: user.id,
      action: "updated",
      entityType: "DemandPricingConfig",
      entityId: row.id,
    });

    revalidatePath("/pricing/demand");
    return {
      success: true,
      data: {
        enabled: row.enabled,
        muhurthamPct: row.muhurthamPct,
        festivalPct: row.festivalPct,
        saturdayPct: row.saturdayPct,
        sundayPct: row.sundayPct,
        scarcityStepPct: row.scarcityStepPct,
        scarcityCapPct: row.scarcityCapPct,
      },
    };
  } catch (e) {
    console.error("[UPDATE_DEMAND_CONFIG_ERROR]", e);
    return { success: false, error: "Failed to save demand config" };
  }
}

// ============================================================
// Hot-dates report — upcoming dates carrying a premium, hottest-first.
// ------------------------------------------------------------
// Scans the next `days` calendar days; for each day that is an active PeakDate
// OR a weekend, classifies it via the shared engine and counts how many
// bookings already sit on that date (across all venues) so Sales can see which
// premium dates are scarce (hold firm) vs still open (push).
// ============================================================

export interface HotDateRow {
  date: string; // "YYYY-MM-DD"
  weekday: string;
  tier: string;
  label: string;
  premiumPct: number;
  basePremiumPct: number;
  scarcityBumpPct: number;
  bookingsOnDate: number;
  peakDateId: string | null;
  venueScopedLabel: string | null; // venue name if peak row is venue-specific
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export async function getHotDates(params?: {
  days?: number;
}): Promise<Result<{ rows: HotDateRow[]; config: DemandConfig }>> {
  const user = await requireRead();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const days = Math.min(365, Math.max(1, params?.days ?? 120));
    const config = await getDemandConfig();

    const todayKey = new Date().toISOString().slice(0, 10);
    const start = dateKeyToUtc(todayKey);
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

    // Active peak dates in window.
    const peakRows = await prisma.peakDate.findMany({
      where: { isActive: true, date: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }, { venueId: "desc" }],
    });
    // Prefer a venue-specific row over an all-venues row for the same day.
    const peakByDay = new Map<
      string,
      { type: string; label: string; premiumPct: number | null; venueId: string | null; id: string }
    >();
    for (const p of peakRows) {
      const key = utcToDateKey(p.date);
      const cur = peakByDay.get(key);
      // venueId desc ordering means venue-specific rows come first; keep the
      // first one we see per day.
      if (!cur) {
        peakByDay.set(key, {
          type: p.type,
          label: p.label,
          premiumPct: p.premiumPct,
          venueId: p.venueId,
          id: p.id,
        });
      }
    }

    // Bookings per UTC day across all venues (scarcity signal).
    const bookings = await prisma.booking.findMany({
      where: { date: { gte: start, lt: end }, status: { notIn: ["CANCELLED"] } },
      select: { date: true },
    });
    const bookingsByDay = new Map<string, number>();
    for (const b of bookings) {
      const key = utcToDateKey(b.date);
      bookingsByDay.set(key, (bookingsByDay.get(key) ?? 0) + 1);
    }

    // Venue names for venue-scoped peak rows.
    const venueIds = Array.from(
      new Set(
        Array.from(peakByDay.values())
          .map((p) => p.venueId)
          .filter((v): v is string => Boolean(v))
      )
    );
    const venues = venueIds.length
      ? await prisma.venue.findMany({
          where: { id: { in: venueIds } },
          select: { id: true, name: true },
        })
      : [];
    const venueName = new Map(venues.map((v) => [v.id, v.name]));

    const rows: HotDateRow[] = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const key = utcToDateKey(day);
      const weekday = day.getUTCDay();
      const isWeekend = weekday === 0 || weekday === 6;
      const peakRaw = peakByDay.get(key);

      // Only dates that carry a premium: an active peak date or a weekend.
      if (!peakRaw && !isWeekend) continue;

      const peak: PeakDateInfo | null = peakRaw
        ? {
            type: peakRaw.type as PeakDateInfo["type"],
            label: peakRaw.label,
            premiumPct: peakRaw.premiumPct,
          }
        : null;

      const bookingsOnDate = bookingsByDay.get(key) ?? 0;
      const demand = classifyDateDemand(config, weekday, peak, bookingsOnDate);

      // Skip dates that ended up with no premium (e.g. weekend with pct 0 and
      // no scarcity) — they're not "hot".
      if (demand.premiumPct <= 0 && demand.tier === "REGULAR") continue;

      rows.push({
        date: key,
        weekday: WEEKDAY_NAMES[weekday],
        tier: demand.tier,
        label: demand.label,
        premiumPct: demand.premiumPct,
        basePremiumPct: demand.basePremiumPct,
        scarcityBumpPct: demand.scarcityBumpPct,
        bookingsOnDate,
        peakDateId: peakRaw?.id ?? null,
        venueScopedLabel:
          peakRaw?.venueId ? venueName.get(peakRaw.venueId) ?? "Specific venue" : null,
      });
    }

    // Hottest first: highest premium, then most-booked, then soonest.
    rows.sort((a, b) => {
      if (b.premiumPct !== a.premiumPct) return b.premiumPct - a.premiumPct;
      if (b.bookingsOnDate !== a.bookingsOnDate)
        return b.bookingsOnDate - a.bookingsOnDate;
      return a.date.localeCompare(b.date);
    });

    return { success: true, data: { rows, config } };
  } catch (e) {
    console.error("[GET_HOT_DATES_ERROR]", e);
    return { success: false, error: "Failed to build hot-dates report" };
  }
}
