"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { TimeSlot } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const SLOTS: TimeSlot[] = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"];

export interface SlotCell {
  status: "FREE" | "HOLD" | "TENTATIVE" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "BLACKOUT";
  label: string | null; // booking number / event / blackout reason
  bookingId: string | null;
}
export interface VenueRow {
  venueId: string;
  venueName: string;
  capacity: number;
  slots: Record<string, SlotCell>;
}

function localDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function requireRead() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !(role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role ?? "", "bookings:read"))) {
    return false;
  }
  return true;
}

// ------------------------------------------------------------
// Day grid: every active venue × 4 slots for one date.
// ------------------------------------------------------------
export async function getAvailabilityGrid(dateISO: string): Promise<Result<VenueRow[]>> {
  if (!(await requireRead())) return { success: false, error: "Unauthorized" };
  const date = localDate(dateISO);
  if (Number.isNaN(date.getTime())) return { success: false, error: "Invalid date." };

  // `Booking.date`/`BlackoutDate.date` are `@db.Date`, which Prisma reads back as
  // UTC-midnight regardless of how the row was written. An exact-equality filter
  // (`where: { date }`) against a *local*-midnight Date is therefore brittle across
  // timezones and would miss real bookings — which is exactly why this grid showed
  // booked slots as "Available" while the month heatmap (a range scan bucketed by
  // UTC day) and the New Booking form's conflict check both saw them correctly.
  // Scan the full UTC day and bucket by `getUTCDate()`, identical to the heatmap,
  // so the grid derives occupancy from the same bookings the form blocks on.
  const dayStart = new Date(dateISO + "T00:00:00.000Z");
  const dayEnd = new Date(dateISO + "T23:59:59.999Z");
  const targetUTCDay = dayStart.getUTCDate();

  const [venues, allBookings, allBlackouts] = await Promise.all([
    prisma.venue.findMany({ where: { isActive: true }, select: { id: true, name: true, capacity: true }, orderBy: { name: "asc" } }),
    prisma.booking.findMany({
      // Match the form's conflict semantics: any non-CANCELLED booking occupies a slot.
      where: { date: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
      select: { id: true, venueId: true, date: true, timeSlot: true, status: true, bookingNumber: true, eventName: true },
    }),
    prisma.blackoutDate.findMany({ where: { date: { gte: dayStart, lte: dayEnd } }, select: { venueId: true, date: true, timeSlot: true, reason: true } }),
  ]);

  const bookings = allBookings.filter((b) => new Date(b.date).getUTCDate() === targetUTCDay);
  const blackouts = allBlackouts.filter((b) => new Date(b.date).getUTCDate() === targetUTCDay);

  const rows: VenueRow[] = venues.map((v) => {
    const vb = bookings.filter((b) => b.venueId === v.id);
    const vx = blackouts.filter((b) => b.venueId === v.id);
    const fullDayBooking = vb.find((b) => b.timeSlot === "FULL_DAY");
    const fullDayBlackout = vx.find((b) => b.timeSlot === null); // null timeSlot = whole-day blackout
    const anyPartialBooking = vb.some((b) => b.timeSlot !== "FULL_DAY");
    const anyPartialBlackout = vx.some((b) => b.timeSlot !== null);

    const slots: Record<string, SlotCell> = {};
    for (const slot of SLOTS) {
      if (slot === "FULL_DAY") {
        // Only a whole-day blackout blacks out the FULL_DAY cell. A partial-slot
        // blackout (or booking) just means the day can no longer be sold as one
        // full-day block — surface that as "partially blocked", not a blackout.
        if (fullDayBlackout) {
          slots[slot] = { status: "BLACKOUT", label: fullDayBlackout.reason || "Blackout", bookingId: null };
        } else if (fullDayBooking) {
          slots[slot] = { status: fullDayBooking.status as SlotCell["status"], label: `${fullDayBooking.bookingNumber} · ${fullDayBooking.eventName}`, bookingId: fullDayBooking.id };
        } else if (anyPartialBooking || anyPartialBlackout) {
          slots[slot] = { status: "HOLD", label: anyPartialBlackout && !anyPartialBooking ? "Partially blocked" : "Partially booked", bookingId: null };
        } else {
          slots[slot] = { status: "FREE", label: null, bookingId: null };
        }
        continue;
      }
      // Partial slot: a whole-day blackout or a blackout for this specific slot wins.
      const bx = fullDayBlackout || vx.find((b) => b.timeSlot === slot);
      if (bx) {
        slots[slot] = { status: "BLACKOUT", label: bx.reason || "Blackout", bookingId: null };
        continue;
      }
      // Partial slot: a FULL_DAY booking blocks it; else its own booking.
      if (fullDayBooking) {
        slots[slot] = { status: fullDayBooking.status as SlotCell["status"], label: `${fullDayBooking.bookingNumber} (full day)`, bookingId: fullDayBooking.id };
        continue;
      }
      const b = vb.find((x) => x.timeSlot === slot);
      slots[slot] = b
        ? { status: b.status as SlotCell["status"], label: `${b.bookingNumber} · ${b.eventName}`, bookingId: b.id }
        : { status: "FREE", label: null, bookingId: null };
    }
    return { venueId: v.id, venueName: v.name, capacity: v.capacity, slots };
  });

  return { success: true, data: rows };
}

// ------------------------------------------------------------
// Month strip: per-venue daily occupancy count (0–3) for a heatmap.
// ------------------------------------------------------------
export interface MonthDay { day: number; booked: number; blackout: boolean }
export interface VenueMonth { venueId: string; venueName: string; days: MonthDay[] }

export async function getAvailabilityMonth(year: number, month: number): Promise<Result<{ days: number; rows: VenueMonth[] }>> {
  if (!(await requireRead())) return { success: false, error: "Unauthorized" };
  // Scan in UTC to match how `@db.Date` reads back (UTC-midnight) and how each day
  // is bucketed below (getUTCDate). Using a local-tz range here would drop or
  // double-count the boundary days (1st/last) under a non-UTC server.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

  const [venues, bookings, blackouts] = await Promise.all([
    prisma.venue.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.booking.findMany({ where: { date: { gte: start, lte: end }, status: { not: "CANCELLED" } }, select: { venueId: true, date: true, timeSlot: true } }),
    prisma.blackoutDate.findMany({ where: { date: { gte: start, lte: end } }, select: { venueId: true, date: true, timeSlot: true } }),
  ]);

  const rows: VenueMonth[] = venues.map((v) => {
    const days: MonthDay[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      // @db.Date values read back as UTC-midnight, so bucket by the UTC day to
      // match the day grid (which filters on a local-midnight Date) in every TZ.
      const dayBookings = bookings.filter((b) => b.venueId === v.id && new Date(b.date).getUTCDate() === d);
      const hasFull = dayBookings.some((b) => b.timeSlot === "FULL_DAY");
      const dayBlackouts = blackouts.filter((b) => b.venueId === v.id && new Date(b.date).getUTCDate() === d);
      // Only a whole-day blackout (timeSlot === null) blacks out the day, matching
      // the day grid. Partial-slot blackouts fold into the occupancy count instead.
      const blackout = dayBlackouts.some((b) => b.timeSlot === null);
      const partialBlackouts = dayBlackouts.filter((b) => b.timeSlot !== null).length;
      const booked = hasFull ? 3 : dayBookings.filter((b) => b.timeSlot !== "FULL_DAY").length + partialBlackouts;
      days.push({ day: d, booked: Math.min(3, booked), blackout });
    }
    return { venueId: v.id, venueName: v.name, days };
  });

  return { success: true, data: { days: daysInMonth, rows } };
}
