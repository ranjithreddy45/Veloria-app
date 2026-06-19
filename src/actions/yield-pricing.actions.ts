"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import {
  venueDemandSignalSchema,
  type VenueDemandSignalInput,
} from "@/schemas/yield-pricing.schema";
import {
  computeYieldPrice,
  type YieldPriceResult,
  type YieldRuleInput,
} from "@/lib/pricing/yield-engine";
import type { TimeSlot } from "@prisma/client";

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };

// ------------------------------------------------------------
// UTC-day range helper (mirrors booking.actions.utcDayRange).
// VenueDemandSignal.date and Booking.date are @db.Date — match by UTC-day
// range, not local-midnight equality, or the signal lookup silently misses.
// ------------------------------------------------------------
function utcDayRange(date: Date): { gte: Date; lt: Date } {
  const gte = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  );
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

// ============================================================
// (1) Calculate Yield Price
// ============================================================
// RBAC pricing:read. Loads venue base price, ALL active pricing rules
// (legacy + yield) ordered by priority asc, the matching VenueDemandSignal
// (slot-specific preferred, falling back to a whole-day timeSlot:null row),
// and the default RatePlan (same OR clause as calculatePrice), then delegates
// to the pure computeYieldPrice engine.
// NOTE: parity with calculatePrice — does not scope venue ownership; never
// expose on a public route.
// ============================================================

export async function calculateYieldPrice(
  venueId: string,
  date: Date,
  timeSlot: string,
  guestCount: number
): Promise<Result<YieldPriceResult>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:read")) {
      return { success: false, error: "Insufficient permissions" };
    }

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true, pricePerSlot: true },
    });

    if (!venue) {
      return { success: false, error: "Venue not found" };
    }

    const bookingDate = new Date(date);
    if (Number.isNaN(bookingDate.getTime())) {
      return { success: false, error: "Invalid date." };
    }
    const { gte, lt } = utcDayRange(bookingDate);

    const [rules, signals, defaultRatePlan] = await Promise.all([
      prisma.pricingRule.findMany({
        where: { venueId, isActive: true },
        orderBy: { priority: "asc" },
      }),
      prisma.venueDemandSignal.findMany({
        where: { venueId, date: { gte, lt } },
      }),
      prisma.ratePlan.findFirst({
        where: {
          OR: [
            { venueId, isDefault: true, isActive: true },
            { venueId: null, isDefault: true, isActive: true },
          ],
        },
        orderBy: { venueId: "desc" }, // Prefer venue-specific over global
      }),
    ]);

    // Slot-specific signal preferred; fall back to whole-day (timeSlot: null).
    const slotSignal =
      signals.find((s) => s.timeSlot === timeSlot) ??
      signals.find((s) => s.timeSlot === null) ??
      null;

    const ruleInputs: YieldRuleInput[] = rules.map((r) => ({
      id: r.id,
      name: r.name,
      ruleType: r.ruleType,
      multiplier: Number(r.multiplier),
      conditions: r.conditions,
      startDate: r.startDate,
      endDate: r.endDate,
      dayOfWeek: r.dayOfWeek,
      minDaysAhead: r.minDaysAhead,
    }));

    const result = computeYieldPrice({
      venueId: venue.id,
      venueName: venue.name,
      basePrice: Number(venue.pricePerSlot),
      date: bookingDate,
      timeSlot,
      guestCount,
      rules: ruleInputs,
      demandSignal: slotSignal
        ? {
            occupancyPct: Number(slotSignal.occupancyPct),
            demandScore: Number(slotSignal.demandScore),
            manualMultiplier:
              slotSignal.manualMultiplier !== null
                ? Number(slotSignal.manualMultiplier)
                : null,
            source: slotSignal.source,
          }
        : null,
      ratePlan: defaultRatePlan
        ? {
            name: defaultRatePlan.name,
            perGuestRate: Number(defaultRatePlan.perGuestRate),
          }
        : null,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("[CALCULATE_YIELD_PRICE_ERROR]", error);
    return { success: false, error: "Failed to calculate yield price" };
  }
}

// ============================================================
// (2) Get Venue Demand Signals (Paginated + Filtered)
// ============================================================

export async function getVenueDemandSignals(params?: {
  venueId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (params?.venueId) {
      where.venueId = params.venueId;
    }
    if (params?.from || params?.to) {
      where.date = {};
      if (params.from) {
        const f = new Date(params.from);
        where.date.gte = utcDayRange(f).gte;
      }
      if (params.to) {
        const t = new Date(params.to);
        where.date.lt = utcDayRange(t).lt;
      }
    }

    const [signals, total] = await Promise.all([
      prisma.venueDemandSignal.findMany({
        where,
        include: { venue: { select: { id: true, name: true } } },
        orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
        skip,
        take: limit,
      }),
      prisma.venueDemandSignal.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(signals),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_VENUE_DEMAND_SIGNALS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch demand signals" };
  }
}

// ============================================================
// (3) Upsert Venue Demand Signal (manual override row)
// ============================================================

export async function upsertVenueDemandSignal(input: VenueDemandSignalInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = venueDemandSignalSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const data = parsed.data;
    const { gte } = utcDayRange(new Date(data.date));
    const timeSlot = (data.timeSlot ?? null) as TimeSlot | null;

    // Find-then-write rather than upsert-on-composite: timeSlot is nullable and
    // SQL treats NULLs as distinct in unique constraints, so an upsert keyed on
    // venueId_date_timeSlot can't reliably target a whole-day (null-slot) row.
    // Prisma renders `{ timeSlot: null }` as `IS NULL`, so findFirst matches it.
    const existingSignal = await prisma.venueDemandSignal.findFirst({
      where: { venueId: data.venueId, date: gte, timeSlot },
      select: { id: true },
    });
    const signalData = {
      occupancyPct: data.occupancyPct,
      demandScore: data.demandScore,
      inquiryCount: data.inquiryCount,
      manualMultiplier: data.manualMultiplier ?? null,
      source: "MANUAL" as const,
    };
    const signal = existingSignal
      ? await prisma.venueDemandSignal.update({
          where: { id: existingSignal.id },
          data: signalData,
          include: { venue: { select: { id: true, name: true } } },
        })
      : await prisma.venueDemandSignal.create({
          data: { venueId: data.venueId, date: gte, timeSlot, ...signalData },
          include: { venue: { select: { id: true, name: true } } },
        });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "VenueDemandSignal",
      entityId: signal.id,
    });

    revalidatePath("/pricing/yield");
    return { success: true as const, data: serialize(signal) };
  } catch (error) {
    console.error("[UPSERT_VENUE_DEMAND_SIGNAL_ERROR]", error);
    return { success: false as const, error: "Failed to save demand signal" };
  }
}

// ============================================================
// (4) Delete Venue Demand Signal
// ============================================================

export async function deleteVenueDemandSignal(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.venueDemandSignal.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Demand signal not found" };
    }

    await prisma.venueDemandSignal.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "VenueDemandSignal",
      entityId: id,
    });

    revalidatePath("/pricing/yield");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_VENUE_DEMAND_SIGNAL_ERROR]", error);
    return { success: false as const, error: "Failed to delete demand signal" };
  }
}
