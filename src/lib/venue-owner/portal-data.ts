// ============================================================
// Venue portal — the ONLY data an owner login can read.
// ------------------------------------------------------------
// Privacy contract (the owner must never see customer contact details or any
// money):
//   • Every query is scoped to the venue ids from getVenuePortalScope(), which
//     come from the owner's VenueOwnerAccess rows on the server — never from
//     the request.
//   • Every query uses an explicit `select` of non-identifying fields: dates,
//     slots, statuses, event type, guest count. Never ids, names, phones,
//     emails, Lead.title (it carries the customer's name), Booking.eventName
//     (ditto), notes, or any Decimal.
//   • Results are counts, or day items carrying only slot / event type /
//     guest count.
// Called from server components only; there is no client-callable action
// that takes a venue id.
// ============================================================

import type { Prisma } from "@prisma/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { findLapsedHoldIds } from "@/lib/holds/release-lapsed-holds";
import {
  conversionPct,
  dbDateKey,
  dbMonthDates,
  istDayKey,
  istMonthInstants,
  istMonthKey,
  istToday,
  lastMonths,
  slotLabel,
} from "./buckets";

export interface OwnerVenue {
  id: string;
  name: string;
}

export interface VenuePortalScope {
  /** True for an admin previewing the portal (sees every active venue). */
  preview: boolean;
  name: string | null;
  venues: OwnerVenue[];
}

/** Booking statuses that mean the event is booked (advance paid or later). */
const BOOKED = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;
/** Booking statuses that hold a date without being confirmed. */
const HELD = ["HOLD", "TENTATIVE"] as const;

/**
 * Who is asking and which venues they may see. A VENUE_OWNER sees exactly the
 * venues granted to them; SUPER_ADMIN / ADMIN may preview any active venue.
 * Anyone else gets null.
 */
export async function getVenuePortalScope(): Promise<VenuePortalScope | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  if (user.role === "VENUE_OWNER") {
    const rows = await prisma.venueOwnerAccess.findMany({
      where: { userId: user.id },
      select: { venue: { select: { id: true, name: true } } },
      orderBy: { venue: { name: "asc" } },
    });
    return { preview: false, name: user.name ?? null, venues: rows.map((r) => r.venue) };
  }
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
    const venues = await prisma.venue.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { preview: true, name: user.name ?? null, venues };
  }
  return null;
}

/**
 * The venue(s) a page should show: the requested one if it is in scope,
 * otherwise all of them. A requested id outside the scope is ignored, never
 * honoured.
 */
export function selectVenues(scope: VenuePortalScope, requested: string | null | undefined): { ids: string[]; selected: string } {
  if (requested && scope.venues.some((v) => v.id === requested)) return { ids: [requested], selected: requested };
  return { ids: scope.venues.map((v) => v.id), selected: "all" };
}

/**
 * A lead belongs to a venue when it names that venue as preferred, or has a
 * quotation for it. (Most ad leads arrive with no venue at all; they cannot be
 * attributed to anyone's venue and are not counted.)
 */
function venueLeads(venueIds: string[]): Prisma.LeadWhereInput {
  return {
    deletedAt: null,
    OR: [{ preferredVenueId: { in: venueIds } }, { salesQuotations: { some: { venueId: { in: venueIds } } } }],
  };
}

/** Converted = won, or its quotation for this venue went through to a booking. */
function convertedLeads(venueIds: string[]): Prisma.LeadWhereInput {
  return { OR: [{ status: "WON" }, { salesQuotations: { some: { venueId: { in: venueIds }, status: "CONVERTED" } } }] };
}

export interface VenueDashboard {
  leads: number;
  converted: number;
  conversionPct: number;
  bookings: number;
  upcomingEvents: number;
  tentativeHolds: number;
  trend: { key: string; label: string; leads: number; converted: number; bookings: number }[];
}

export async function getVenueDashboard(
  venueIds: string[],
  range: { from: Date | null; to: Date | null; fromDate: Date | null; toDate: Date | null },
  now: Date = new Date(),
): Promise<VenueDashboard> {
  const empty: VenueDashboard = { leads: 0, converted: 0, conversionPct: 0, bookings: 0, upcomingEvents: 0, tentativeHolds: 0, trend: [] };
  if (venueIds.length === 0) return empty;

  const createdAt = range.from && range.to ? { gte: range.from, lt: range.to } : undefined;
  const eventDate = range.fromDate && range.toDate ? { gte: range.fromDate, lt: range.toDate } : undefined;
  const today = istToday(now);
  const months = lastMonths(now, 6);
  const trendFrom = istMonthInstants(months[0].year, months[0].month).start;
  const trendFromDate = dbMonthDates(months[0].year, months[0].month).start;

  const [leads, converted, bookings, upcomingEvents, heldRows, trendLeads, trendBookings] = await Promise.all([
    prisma.lead.count({ where: { AND: [venueLeads(venueIds), ...(createdAt ? [{ createdAt }] : [])] } }),
    prisma.lead.count({ where: { AND: [venueLeads(venueIds), convertedLeads(venueIds), ...(createdAt ? [{ createdAt }] : [])] } }),
    prisma.booking.count({ where: { venueId: { in: venueIds }, status: { in: [...BOOKED] }, ...(eventDate ? { date: eventDate } : {}) } }),
    prisma.booking.count({ where: { venueId: { in: venueIds }, status: { in: ["CONFIRMED", "IN_PROGRESS"] }, date: { gte: today } } }),
    // ids are used only to drop lapsed holds; they never leave this function.
    prisma.booking.findMany({
      where: { venueId: { in: venueIds }, status: { in: [...HELD] }, date: { gte: today } },
      select: { id: true, status: true, holdExpiresAt: true },
    }),
    prisma.lead.findMany({
      where: { AND: [venueLeads(venueIds), { createdAt: { gte: trendFrom } }] },
      select: {
        createdAt: true,
        status: true,
        salesQuotations: { where: { venueId: { in: venueIds }, status: "CONVERTED" }, select: { status: true }, take: 1 },
      },
    }),
    prisma.booking.findMany({
      where: { venueId: { in: venueIds }, status: { in: [...BOOKED] }, date: { gte: trendFromDate } },
      select: { date: true },
    }),
  ]);

  const lapsed = await findLapsedHoldIds(heldRows, now);
  const trend = months.map((m) => ({ key: m.key, label: m.label, leads: 0, converted: 0, bookings: 0 }));
  const byKey = new Map(trend.map((t) => [t.key, t]));
  for (const l of trendLeads) {
    const t = byKey.get(istMonthKey(l.createdAt));
    if (!t) continue;
    t.leads++;
    if (l.status === "WON" || l.salesQuotations.length > 0) t.converted++;
  }
  for (const b of trendBookings) {
    const t = byKey.get(dbDateKey(b.date).slice(0, 7));
    if (t) t.bookings++;
  }

  return {
    leads,
    converted,
    conversionPct: conversionPct(leads, converted),
    bookings,
    upcomingEvents,
    tentativeHolds: heldRows.filter((h) => !lapsed.has(h.id)).length,
    trend,
  };
}

export interface CalendarItem {
  kind: "booking" | "hold" | "lead";
  slot: string | null;
  eventType: string | null;
  guests: number | null;
  /** Only when more than one venue is shown. */
  venue: string | null;
}

export interface CalendarDay {
  leads: number;
  bookings: number;
  holds: number;
  items: CalendarItem[];
}

export interface VenueCalendar {
  days: Record<string, CalendarDay>;
  totals: { leads: number; bookings: number; holds: number };
}

/**
 * One month of the calendar: per India date, how many open enquiries name it
 * as their event date, and how many bookings (and tentative holds) the venue
 * has on it. Lapsed holds and cancelled bookings are left out, as on the staff
 * calendar. Won/lost leads are left out — a won lead is the booking.
 */
export async function getVenueCalendar(venueIds: string[], venues: OwnerVenue[], year: number, month: number, now: Date = new Date()): Promise<VenueCalendar> {
  const days: Record<string, CalendarDay> = {};
  const totals = { leads: 0, bookings: 0, holds: 0 };
  if (venueIds.length === 0) return { days, totals };

  const names = new Map(venues.map((v) => [v.id, v.name]));
  const showVenue = venueIds.length > 1;
  const leadWindow = istMonthInstants(year, month);
  const bookingWindow = dbMonthDates(year, month);

  const [leads, bookingRows] = await Promise.all([
    prisma.lead.findMany({
      where: {
        AND: [
          venueLeads(venueIds),
          { eventDate: { gte: leadWindow.start, lt: leadWindow.end } },
          { status: { notIn: ["WON", "LOST"] } },
        ],
      },
      select: { eventDate: true, slot: true, eventType: true, guestCount: true, preferredVenueId: true },
    }),
    prisma.booking.findMany({
      where: { venueId: { in: venueIds }, status: { not: "CANCELLED" }, date: { gte: bookingWindow.start, lt: bookingWindow.end } },
      // id only to drop lapsed holds below; it is not returned.
      select: { id: true, status: true, holdExpiresAt: true, date: true, timeSlot: true, eventType: true, guestCount: true, venueId: true },
    }),
  ]);

  const lapsed = await findLapsedHoldIds(bookingRows, now);
  const day = (key: string) => (days[key] ??= { leads: 0, bookings: 0, holds: 0, items: [] });

  for (const b of bookingRows) {
    if (lapsed.has(b.id)) continue;
    const held = (HELD as readonly string[]).includes(b.status);
    const d = day(dbDateKey(b.date));
    if (held) {
      d.holds++;
      totals.holds++;
    } else {
      d.bookings++;
      totals.bookings++;
    }
    d.items.push({
      kind: held ? "hold" : "booking",
      slot: slotLabel(b.timeSlot),
      eventType: b.eventType || null,
      guests: b.guestCount || null,
      venue: showVenue ? names.get(b.venueId) ?? null : null,
    });
  }
  for (const l of leads) {
    if (!l.eventDate) continue;
    const d = day(istDayKey(l.eventDate));
    d.leads++;
    totals.leads++;
    d.items.push({
      kind: "lead",
      slot: slotLabel(l.slot),
      eventType: l.eventType || null,
      guests: l.guestCount ?? null,
      venue: showVenue && l.preferredVenueId ? names.get(l.preferredVenueId) ?? null : null,
    });
  }
  const order = { booking: 0, hold: 1, lead: 2 } as const;
  for (const d of Object.values(days)) d.items.sort((a, b) => order[a.kind] - order[b.kind]);
  return { days, totals };
}
