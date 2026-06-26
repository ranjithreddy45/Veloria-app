"use server";

import { auth } from "@/../auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { SLOT_LABEL, type TimeSlotEnum } from "@/lib/sales/slot";
import {
  computeSellDownDrafts,
  utcDateFromKey,
  utcDayKey,
  SELL_DOWN_WINDOW_DAYS,
  type SellDownBoardData,
  type SellDownBooking,
  type SellDownBlackout,
  type SellDownLead,
  type SellDownMatchedLead,
  type SellDownTargetView,
  type SellDownVenue,
} from "@/lib/sales/sell-down";

// ============================================================
// Empty-Date Sell-Down — internal, RBAC-gated staff actions.
// All return Result<T>, gate at top via auth() + bookings:read (the same gate
// as /availability + getAvailabilityGrid — reps who work availability hold it).
// Decimal occupancyPct → Number() only at the read boundary. No money math,
// no slot mutation: WORKING is a soft work-claim, never a slot lock.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

// Open lead statuses worth chasing for empty inventory.
const OPEN_LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED"] as const;
const TARGET_STATUSES = ["OPEN", "WORKING", "FILLED", "EXPIRED"] as const;

async function requireRead(): Promise<boolean> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (
    !session?.user ||
    !(role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role ?? "", "bookings:read"))
  ) {
    return false;
  }
  return true;
}

async function sessionUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export interface SellDownBoardParams {
  venueId?: string;
  from?: string; // ISO "YYYY-MM-DD" inclusive
  to?: string; // ISO "YYYY-MM-DD" exclusive-ish (lte)
  peakOnly?: boolean;
  status?: string; // OPEN | WORKING | FILLED | EXPIRED
}

// ------------------------------------------------------------
// Read the persisted board: SellDownTarget rows joined to venue name +
// live-hydrated matched OPEN leads. Stale matchedLeadIds are re-validated at
// read time — soft-deleted / now-closed leads are dropped so we never surface
// a converted lead as still-open inventory.
// ------------------------------------------------------------
export async function getSellDownBoard(
  params?: SellDownBoardParams
): Promise<Result<SellDownBoardData>> {
  if (!(await requireRead())) return { success: false, error: "Unauthorized" };

  const where: Prisma.SellDownTargetWhereInput = {};
  if (params?.venueId) where.venueId = params.venueId;
  if (params?.peakOnly) where.isPeakDate = true;
  if (params?.status && (TARGET_STATUSES as readonly string[]).includes(params.status)) {
    where.status = params.status;
  } else {
    // Default board view: actionable inventory only (hide EXPIRED noise).
    where.status = { in: ["OPEN", "WORKING", "FILLED"] };
  }

  // Date window. Default: today (UTC) forward through the scan window.
  const todayKey = new Date().toISOString().slice(0, 10);
  const fromKey = params?.from ?? todayKey;
  const fromDate = utcDateFromKey(fromKey);
  const toKey =
    params?.to ??
    utcDayKey(new Date(fromDate.getTime() + SELL_DOWN_WINDOW_DAYS * 24 * 60 * 60 * 1000));
  where.date = { gte: fromDate, lte: utcDateFromKey(toKey) };

  const rows = await prisma.sellDownTarget.findMany({
    where,
    orderBy: [{ date: "asc" }, { occupancyPct: "asc" }],
    take: 500,
  });

  if (rows.length === 0) {
    return {
      success: true,
      data: {
        targets: [],
        kpis: { openPeakSlots: 0, perishableNights: 0, matchedLeadCoveragePct: 0, totalMatchedLeads: 0 },
        computedAt: null,
      },
    };
  }

  // Hydrate venues.
  const venueIds = Array.from(new Set(rows.map((r) => r.venueId)));
  const venues = await prisma.venue.findMany({
    where: { id: { in: venueIds } },
    select: { id: true, name: true },
  });
  const venueName = new Map(venues.map((v) => [v.id, v.name]));

  // Hydrate matched leads LIVE — drop soft-deleted / now-closed ones.
  const allLeadIds = Array.from(new Set(rows.flatMap((r) => r.matchedLeadIds)));
  const leads = allLeadIds.length
    ? await prisma.lead.findMany({
        where: {
          id: { in: allLeadIds },
          deletedAt: null,
          status: { in: [...OPEN_LEAD_STATUSES] },
        },
        select: {
          id: true,
          title: true,
          eventDate: true,
          eventType: true,
          guestCount: true,
          score: true,
          contact: { select: { firstName: true, lastName: true } },
          assignedTo: { select: { name: true } },
        },
      })
    : [];
  const leadById = new Map<string, SellDownMatchedLead>();
  for (const l of leads) {
    const contactName =
      [l.contact?.firstName, l.contact?.lastName].filter(Boolean).join(" ").trim() || null;
    leadById.set(l.id, {
      id: l.id,
      title: l.title,
      contactName,
      eventDate: l.eventDate ? l.eventDate.toISOString() : null,
      eventType: l.eventType,
      guestCount: l.guestCount,
      score: l.score,
      assignedToName: l.assignedTo?.name ?? null,
    });
  }

  const targets: SellDownTargetView[] = rows.map((r) => {
    const liveMatches = r.matchedLeadIds
      .map((id) => leadById.get(id))
      .filter((x): x is SellDownMatchedLead => Boolean(x));
    return {
      id: r.id,
      venueId: r.venueId,
      venueName: venueName.get(r.venueId) ?? "Unknown venue",
      dateISO: utcDayKey(r.date),
      timeSlot: r.timeSlot,
      slotLabel: SLOT_LABEL[r.timeSlot as TimeSlotEnum] ?? r.timeSlot,
      occupancyPct: Number(r.occupancyPct), // Decimal → Number at boundary
      isPeakDate: r.isPeakDate,
      status: r.status,
      matchedLeadCount: liveMatches.length,
      matchedLeads: liveMatches,
      computedAt: r.computedAt.toISOString(),
    };
  });

  // KPIs over the actionable (non-EXPIRED) view.
  const actionable = targets.filter((t) => t.status === "OPEN" || t.status === "WORKING");
  const openPeakSlots = actionable.filter((t) => t.isPeakDate).length;
  const perishableNights = new Set(actionable.map((t) => `${t.venueId}|${t.dateISO}`)).size;
  const withLeads = actionable.filter((t) => t.matchedLeadCount > 0).length;
  const matchedLeadCoveragePct = actionable.length
    ? Math.round((withLeads / actionable.length) * 100)
    : 0;
  const totalMatchedLeads = new Set(actionable.flatMap((t) => t.matchedLeads.map((l) => l.id))).size;

  const computedAt = rows.reduce<string | null>((max, r) => {
    const iso = r.computedAt.toISOString();
    return !max || iso > max ? iso : max;
  }, null);

  return {
    success: true,
    data: {
      targets,
      kpis: { openPeakSlots, perishableNights, matchedLeadCoveragePct, totalMatchedLeads },
      computedAt,
    },
  };
}

// ------------------------------------------------------------
// On-demand rebuild ("Refresh now" button) — delegates to the same pure engine
// + upsert path the cron uses. Gated. Idempotent.
// ------------------------------------------------------------
export async function computeSellDownNow(): Promise<Result<{ upserts: number }>> {
  if (!(await requireRead())) return { success: false, error: "Unauthorized" };

  const ranAt = new Date();
  const todayKey = ranAt.toISOString().slice(0, 10);
  const windowStart = utcDateFromKey(todayKey);
  const windowEnd = new Date(
    windowStart.getTime() + SELL_DOWN_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const venueRows = await prisma.venue.findMany({
    where: { isActive: true },
    select: { id: true, capacity: true },
  });
  if (venueRows.length === 0) return { success: true, data: { upserts: 0 } };
  const venueIds = venueRows.map((v) => v.id);

  const [bookings, blackouts, leads] = await Promise.all([
    prisma.booking.findMany({
      where: {
        venueId: { in: venueIds },
        status: { not: "CANCELLED" },
        date: { gte: windowStart, lt: windowEnd },
      },
      select: { venueId: true, date: true, timeSlot: true },
    }),
    prisma.blackoutDate.findMany({
      where: { venueId: { in: venueIds }, date: { gte: windowStart, lt: windowEnd } },
      select: { venueId: true, date: true, timeSlot: true },
    }),
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { in: [...OPEN_LEAD_STATUSES] },
        eventDate: { gte: windowStart, lt: windowEnd },
      },
      select: {
        id: true,
        eventDate: true,
        eventType: true,
        guestCount: true,
        preferredVenueId: true,
        score: true,
      },
    }),
  ]);

  const venues: SellDownVenue[] = venueRows;
  const drafts = computeSellDownDrafts({
    venues,
    bookings: bookings as SellDownBooking[],
    blackouts: blackouts as SellDownBlackout[],
    leads: leads as SellDownLead[],
    windowStartKey: todayKey,
    windowDays: SELL_DOWN_WINDOW_DAYS,
  });

  let upserts = 0;
  const liveKeys = new Set<string>();
  for (const d of drafts) {
    const date = utcDateFromKey(d.dateKey);
    liveKeys.add(`${d.venueId}|${d.dateKey}|${d.timeSlot}`);
    await prisma.sellDownTarget.upsert({
      where: {
        venueId_date_timeSlot: { venueId: d.venueId, date, timeSlot: d.timeSlot },
      },
      create: {
        venueId: d.venueId,
        date,
        timeSlot: d.timeSlot,
        occupancyPct: new Prisma.Decimal(d.occupancyPct),
        isPeakDate: d.isPeakDate,
        matchedLeadIds: d.matchedLeadIds,
        matchedLeadCount: d.matchedLeadCount,
        status: "OPEN",
        computedAt: ranAt,
      },
      update: {
        occupancyPct: new Prisma.Decimal(d.occupancyPct),
        isPeakDate: d.isPeakDate,
        matchedLeadIds: d.matchedLeadIds,
        matchedLeadCount: d.matchedLeadCount,
        computedAt: ranAt,
      },
    });
    upserts++;
  }

  // Expire past-date actionable rows + in-window OPEN rows no longer perishable.
  await prisma.sellDownTarget.updateMany({
    where: { date: { lt: windowStart }, status: { in: ["OPEN", "WORKING"] } },
    data: { status: "EXPIRED" },
  });
  const inWindowOpen = await prisma.sellDownTarget.findMany({
    where: {
      venueId: { in: venueIds },
      date: { gte: windowStart, lt: windowEnd },
      status: "OPEN",
    },
    select: { id: true, venueId: true, date: true, timeSlot: true },
  });
  const staleIds = inWindowOpen
    .filter((r) => !liveKeys.has(`${r.venueId}|${utcDayKey(r.date)}|${r.timeSlot}`))
    .map((r) => r.id);
  if (staleIds.length > 0) {
    await prisma.sellDownTarget.updateMany({
      where: { id: { in: staleIds } },
      data: { status: "EXPIRED" },
    });
  }

  revalidatePath("/availability/sell-down");
  return { success: true, data: { upserts } };
}

// ------------------------------------------------------------
// Rep claims/closes a target. WORKING is a soft work-claim (not a slot lock);
// FILLED marks it converted; EXPIRED dismisses it. No money/slot mutation.
// ------------------------------------------------------------
export async function markSellDownTargetStatus(
  id: string,
  status: "WORKING" | "FILLED" | "EXPIRED"
): Promise<Result<{ id: string }>> {
  if (!(await requireRead())) return { success: false, error: "Unauthorized" };
  if (!id) return { success: false, error: "Missing target id." };
  if (!["WORKING", "FILLED", "EXPIRED"].includes(status)) {
    return { success: false, error: "Invalid status." };
  }

  const existing = await prisma.sellDownTarget.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { success: false, error: "Target not found." };

  await prisma.sellDownTarget.update({
    where: { id },
    data: { status },
  });

  // Touch session user only to confirm an authenticated actor performed it
  // (kept for parity with other gated mutations; no ownership filtering — this
  // is a single-company ERP with staff-wide visibility by design).
  await sessionUserId();

  revalidatePath("/availability/sell-down");
  return { success: true, data: { id } };
}
