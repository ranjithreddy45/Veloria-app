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
  ownerOccasion,
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
 * A lead belongs to a venue when it names that venue as preferred, has a
 * quotation for it, or its deal was booked there. (Most ad leads arrive with
 * no venue at all; they cannot be attributed to anyone's venue and are not
 * counted.)
 */
function venueLeads(venueIds: string[]): Prisma.LeadWhereInput {
  return {
    deletedAt: null,
    OR: [
      { preferredVenueId: { in: venueIds } },
      { salesQuotations: { some: { venueId: { in: venueIds } } } },
      { deal: { is: { booking: { is: { venueId: { in: venueIds } } } } } },
    ],
  };
}

/**
 * The bookings that count as a conversion at these venues: confirmed or later
 * (advance paid), with the leads they came from. A lead reaches a booking by
 * one of three paths — its deal, a quotation whose slot was blocked, or a
 * public date hold — and only a booking AT THESE VENUES counts, so a lead won
 * elsewhere is never a conversion here. Quotation status CONVERTED is not used:
 * it means "advance invoice raised", which can stay unpaid, and one-tap
 * bookings never set it.
 */
async function bookedLeadIds(venueIds: string[]): Promise<Set<string>> {
  const booked = await prisma.booking.findMany({
    where: { venueId: { in: venueIds }, status: { in: [...BOOKED] } },
    select: { id: true, deal: { select: { leadId: true } } },
  });
  const ids = booked.map((b) => b.id);
  const leadIds = new Set(booked.flatMap((b) => (b.deal?.leadId ? [b.deal.leadId] : [])));
  if (ids.length === 0) return leadIds;
  const [quotes, holds] = await Promise.all([
    prisma.salesQuotation.findMany({ where: { bookingId: { in: ids }, leadId: { not: null } }, select: { leadId: true } }),
    prisma.publicHold.findMany({ where: { bookingId: { in: ids }, leadId: { not: null } }, select: { leadId: true } }),
  ]);
  for (const q of quotes) if (q.leadId) leadIds.add(q.leadId);
  for (const h of holds) if (h.leadId) leadIds.add(h.leadId);
  return leadIds;
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

  const convertedIds = [...(await bookedLeadIds(venueIds))];
  // A lead booked here is this venue's lead even if it never named the venue.
  const inScope: Prisma.LeadWhereInput = convertedIds.length
    ? { OR: [venueLeads(venueIds), { id: { in: convertedIds }, deletedAt: null }] }
    : venueLeads(venueIds);

  const [leads, converted, bookings, upcomingEvents, heldRows, trendLeads, trendBookings] = await Promise.all([
    prisma.lead.count({ where: { AND: [inScope, ...(createdAt ? [{ createdAt }] : [])] } }),
    // Converted leads of this cohort; a converted lead is attributed to the
    // venue by its booking even if it never named the venue.
    convertedIds.length
      ? prisma.lead.count({ where: { AND: [{ deletedAt: null }, { id: { in: convertedIds } }, ...(createdAt ? [{ createdAt }] : [])] } })
      : Promise.resolve(0),
    prisma.booking.count({ where: { venueId: { in: venueIds }, status: { in: [...BOOKED] }, ...(eventDate ? { date: eventDate } : {}) } }),
    prisma.booking.count({ where: { venueId: { in: venueIds }, status: { in: ["CONFIRMED", "IN_PROGRESS"] }, date: { gte: today } } }),
    // ids are used only to drop lapsed holds; they never leave this function.
    prisma.booking.findMany({
      where: { venueId: { in: venueIds }, status: { in: [...HELD] }, date: { gte: today } },
      select: { id: true, status: true, holdExpiresAt: true },
    }),
    // id is used only to look up conversion; it never leaves this function.
    prisma.lead.findMany({
      where: { AND: [inScope, { createdAt: { gte: trendFrom } }] },
      select: { id: true, createdAt: true },
    }),
    prisma.booking.findMany({
      where: { venueId: { in: venueIds }, status: { in: [...BOOKED] }, date: { gte: trendFromDate } },
      select: { date: true },
    }),
  ]);

  const lapsed = await findLapsedHoldIds(heldRows, now);
  const trend = months.map((m) => ({ key: m.key, label: m.label, leads: 0, converted: 0, bookings: 0 }));
  const byKey = new Map(trend.map((t) => [t.key, t]));
  const convertedSet = new Set(convertedIds);
  for (const l of trendLeads) {
    const t = byKey.get(istMonthKey(l.createdAt));
    if (!t) continue;
    t.leads++;
    if (convertedSet.has(l.id)) t.converted++;
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
    // id / booking links are used only to drop leads already booked and to
    // name the venue; none of them leaves this function.
    prisma.lead.findMany({
      where: {
        AND: [
          venueLeads(venueIds),
          { eventDate: { gte: leadWindow.start, lt: leadWindow.end } },
          { status: { notIn: ["WON", "LOST"] } },
        ],
      },
      select: {
        id: true,
        eventDate: true,
        slot: true,
        eventType: true,
        guestCount: true,
        preferredVenueId: true,
        salesQuotations: { select: { venueId: true, bookingId: true }, orderBy: { createdAt: "desc" } },
        deal: { select: { booking: { select: { id: true } } } },
      },
    }),
    prisma.booking.findMany({
      where: { venueId: { in: venueIds }, status: { not: "CANCELLED" }, date: { gte: bookingWindow.start, lt: bookingWindow.end } },
      // id only to drop lapsed holds below; it is not returned.
      select: { id: true, status: true, holdExpiresAt: true, date: true, timeSlot: true, eventType: true, guestCount: true, venueId: true },
    }),
  ]);

  const lapsed = await findLapsedHoldIds(bookingRows, now);
  const day = (key: string) => (days[key] ??= { leads: 0, bookings: 0, holds: 0, items: [] });

  // An open lead whose booking already exists (not cancelled, not a lapsed
  // hold) is shown once — as the booking — not again as an enquiry.
  // Same three paths as bookedLeadIds: deal, quotation, public date hold.
  const holds = leads.length
    ? await prisma.publicHold.findMany({
        where: { leadId: { in: leads.map((l) => l.id) }, bookingId: { not: null } },
        select: { leadId: true, bookingId: true },
      })
    : [];
  const linked = new Map<string, string[]>();
  for (const l of leads) {
    const ids = [
      ...l.salesQuotations.flatMap((q) => (q.bookingId ? [q.bookingId] : [])),
      ...(l.deal?.booking ? [l.deal.booking.id] : []),
      ...holds.flatMap((h) => (h.leadId === l.id && h.bookingId ? [h.bookingId] : [])),
    ];
    if (ids.length) linked.set(l.id, ids);
  }
  const linkedIds = [...new Set([...linked.values()].flat())];
  const liveLinked = new Set<string>();
  if (linkedIds.length) {
    const rows = await prisma.booking.findMany({
      where: { id: { in: linkedIds }, status: { not: "CANCELLED" } },
      select: { id: true, status: true, holdExpiresAt: true },
    });
    const lapsedLinked = await findLapsedHoldIds(rows, now);
    for (const r of rows) if (!lapsedLinked.has(r.id)) liveLinked.add(r.id);
  }

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
      eventType: ownerOccasion(b.eventType),
      guests: b.guestCount || null,
      venue: showVenue ? names.get(b.venueId) ?? null : null,
    });
  }
  for (const l of leads) {
    if (!l.eventDate) continue;
    if ((linked.get(l.id) ?? []).some((id) => liveLinked.has(id))) continue;
    const d = day(istDayKey(l.eventDate));
    d.leads++;
    totals.leads++;
    // The in-scope venue it belongs to: its preferred venue, else its latest
    // quotation's venue.
    const venueId =
      l.preferredVenueId && names.has(l.preferredVenueId)
        ? l.preferredVenueId
        : l.salesQuotations.find((q) => q.venueId && names.has(q.venueId))?.venueId ?? null;
    d.items.push({
      kind: "lead",
      slot: slotLabel(l.slot),
      eventType: ownerOccasion(l.eventType),
      guests: l.guestCount ?? null,
      venue: showVenue && venueId ? names.get(venueId) ?? null : null,
    });
  }
  const order = { booking: 0, hold: 1, lead: 2 } as const;
  for (const d of Object.values(days)) d.items.sort((a, b) => order[a.kind] - order[b.kind]);
  return { days, totals };
}
