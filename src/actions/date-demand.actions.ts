"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { utcDayRange } from "@/lib/sales/slot-util";
import {
  classifyDateDemand,
  DEFAULT_DEMAND_CONFIG,
  type DateDemand,
  type DemandConfig,
} from "@/lib/pricing/date-demand";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

/** Load the singleton demand-pricing config (defaults if none saved yet). */
export async function getDemandConfig(): Promise<DemandConfig> {
  const row = await prisma.demandPricingConfig.findFirst().catch(() => null);
  if (!row) return DEFAULT_DEMAND_CONFIG;
  return {
    enabled: row.enabled,
    muhurthamPct: row.muhurthamPct,
    festivalPct: row.festivalPct,
    saturdayPct: row.saturdayPct,
    sundayPct: row.sundayPct,
    scarcityStepPct: row.scarcityStepPct,
    scarcityCapPct: row.scarcityCapPct,
  };
}

export interface DateDemandResult extends DateDemand {
  dateISO: string;
}

/**
 * The team-facing answer to "how much do I charge on this date?". Returns the
 * demand tier + recommended premium % + scarcity, for the quote builder banner.
 * Best-effort: a failure returns a REGULAR (no-premium) result so it never
 * blocks quoting.
 */
export async function getDateDemand(
  dateISO: string,
  venueId?: string | null,
  _slot?: string | null
): Promise<Result<DateDemandResult>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  // Any rep who can read/build quotes may see pricing guidance.
  if (!hasPermission(user.role ?? "", "quotes:read") && !hasPermission(user.role ?? "", "pricing:read"))
    return { success: false, error: "Insufficient permissions" };

  try {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO ?? "");
    if (!m) return { success: false, error: "Invalid date" };
    const dayUtc = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    const weekdayUtc = dayUtc.getUTCDay();

    const config = await getDemandConfig();

    // Matching peak date for this day (venue-specific or all-venues).
    const { gte, lt } = utcDayRange(dayUtc);
    const peakRow = await prisma.peakDate.findFirst({
      where: {
        isActive: true,
        date: { gte, lt },
        OR: [{ venueId: null }, ...(venueId ? [{ venueId }] : [])],
      },
      orderBy: { venueId: "desc" }, // prefer a venue-specific row over all-venues
      select: { type: true, label: true, premiumPct: true },
    });
    const peak = peakRow
      ? { type: peakRow.type as "MUHURTHAM" | "FESTIVAL" | "CUSTOM", label: peakRow.label, premiumPct: peakRow.premiumPct }
      : null;

    // Scarcity — how many slots on this date are already taken at this venue.
    let bookedSlots = 0;
    if (venueId) {
      bookedSlots = await prisma.booking.count({
        where: { venueId, date: { gte, lt }, status: { notIn: ["CANCELLED"] } },
      });
    }

    const demand = classifyDateDemand(config, weekdayUtc, peak, bookedSlots);
    return { success: true, data: { ...demand, dateISO } };
  } catch (e) {
    console.error("[GET_DATE_DEMAND_ERROR]", e);
    // Never block quoting on a pricing-guidance failure.
    return { success: true, data: { ...classifyDateDemand({ ...DEFAULT_DEMAND_CONFIG, enabled: false }, 1, null, 0), dateISO } };
  }
}
