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

  const [venues, bookings, blackouts] = await Promise.all([
    prisma.venue.findMany({ where: { isActive: true }, select: { id: true, name: true, capacity: true }, orderBy: { name: "asc" } }),
    prisma.booking.findMany({
      where: { date, status: { not: "CANCELLED" } },
      select: { id: true, venueId: true, timeSlot: true, status: true, bookingNumber: true, eventName: true },
    }),
    prisma.blackoutDate.findMany({ where: { date }, select: { venueId: true, timeSlot: true, reason: true } }),
  ]);

  const rows: VenueRow[] = venues.map((v) => {
    const vb = bookings.filter((b) => b.venueId === v.id);
    const vx = blackouts.filter((b) => b.venueId === v.id);
    const fullDayBooking = vb.find((b) => b.timeSlot === "FULL_DAY");
    const fullDayBlackout = vx.find((b) => b.timeSlot === null);
    const anyPartialBooking = vb.some((b) => b.timeSlot !== "FULL_DAY");

    const slots: Record<string, SlotCell> = {};
    for (const slot of SLOTS) {
      // Blackout takes priority.
      const bx = vx.find((b) => b.timeSlot === slot) || (fullDayBlackout && slot !== "FULL_DAY" ? fullDayBlackout : null) || (slot === "FULL_DAY" && (fullDayBlackout || vx.length) ? (fullDayBlackout ?? vx[0]) : null);
      if (bx) {
        slots[slot] = { status: "BLACKOUT", label: bx.reason || "Blackout", bookingId: null };
        continue;
      }
      if (slot === "FULL_DAY") {
        if (fullDayBooking) {
          slots[slot] = { status: fullDayBooking.status as SlotCell["status"], label: `${fullDayBooking.bookingNumber} · ${fullDayBooking.eventName}`, bookingId: fullDayBooking.id };
        } else if (anyPartialBooking) {
          slots[slot] = { status: "HOLD", label: "Partially booked", bookingId: null };
        } else {
          slots[slot] = { status: "FREE", label: null, bookingId: null };
        }
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
  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month, 0); // last day of month
  end.setHours(23, 59, 59, 999);
  const daysInMonth = end.getDate();

  const [venues, bookings, blackouts] = await Promise.all([
    prisma.venue.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.booking.findMany({ where: { date: { gte: start, lte: end }, status: { not: "CANCELLED" } }, select: { venueId: true, date: true, timeSlot: true } }),
    prisma.blackoutDate.findMany({ where: { date: { gte: start, lte: end } }, select: { venueId: true, date: true } }),
  ]);

  const rows: VenueMonth[] = venues.map((v) => {
    const days: MonthDay[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayBookings = bookings.filter((b) => b.venueId === v.id && new Date(b.date).getDate() === d);
      const hasFull = dayBookings.some((b) => b.timeSlot === "FULL_DAY");
      const booked = hasFull ? 3 : dayBookings.filter((b) => b.timeSlot !== "FULL_DAY").length;
      const blackout = blackouts.some((b) => b.venueId === v.id && new Date(b.date).getDate() === d);
      days.push({ day: d, booked: Math.min(3, booked), blackout });
    }
    return { venueId: v.id, venueName: v.name, days };
  });

  return { success: true, data: { days: daysInMonth, rows } };
}
