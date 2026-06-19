import { prisma } from "@/lib/prisma";
import type { TimeSlot } from "@prisma/client";

// ============================================================
// OTA Outbound Feed Builders (public-safe projection)
// ============================================================
// These build the PUBLIC availability feed for a single venue. They reuse the
// EXACT occupancy semantics of the internal availability grid
// (getAvailabilityGrid / getAvailabilityMonth in src/actions/availability.actions.ts):
//   - Booking.date / BlackoutDate.date are @db.Date and read back as UTC-midnight,
//     so we scan a full UTC day range and bucket by getUTCDate().
//   - Any non-CANCELLED booking occupies a slot.
//   - A whole-day blackout (timeSlot === null) blocks all four slots.
//   - A FULL_DAY booking blocks every partial slot for that day.
// CRITICAL (PII gate): the feed emits ONLY date / timeSlot / status. It NEVER
// includes contact names, booking numbers, event names, amounts, internal
// notes, or blackout reasons. The internal grid selects those for staff; here
// they are deliberately projected out.

const SLOTS: TimeSlot[] = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"];

export type FeedSlotStatus = "AVAILABLE" | "BOOKED" | "BLACKOUT";

export interface FeedSlot {
  date: string; // YYYY-MM-DD (UTC day)
  timeSlot: TimeSlot;
  status: FeedSlotStatus;
}

export interface AvailabilityFeed {
  venue: { id: string; name: string; capacity: number };
  generatedAt: string; // ISO timestamp
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  slots: FeedSlot[];
}

// Format a Date's UTC components as YYYY-MM-DD (matches the @db.Date convention).
function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Normalise an arbitrary Date to UTC-midnight of that calendar day.
function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Build the per-day, per-slot availability for one venue across an inclusive
 * UTC day range. Returns null if the venue does not exist or is inactive
 * (so the public feed fails closed rather than leaking a 200 with an empty body).
 */
export async function buildAvailabilityJson(
  venueId: string,
  fromDate: Date,
  toDate: Date
): Promise<AvailabilityFeed | null> {
  const start = utcMidnight(fromDate);
  // Inclusive end-of-day so the final day's bookings are scanned.
  const endDay = utcMidnight(toDate);
  const end = new Date(
    Date.UTC(endDay.getUTCFullYear(), endDay.getUTCMonth(), endDay.getUTCDate(), 23, 59, 59, 999)
  );

  const venue = await prisma.venue.findFirst({
    where: { id: venueId, isActive: true },
    select: { id: true, name: true, capacity: true },
  });
  if (!venue) return null;

  const [bookings, blackouts] = await Promise.all([
    prisma.booking.findMany({
      // Same conflict semantics as the grid: any non-CANCELLED booking occupies a slot.
      where: { venueId, date: { gte: start, lte: end }, status: { not: "CANCELLED" } },
      select: { date: true, timeSlot: true },
    }),
    prisma.blackoutDate.findMany({
      where: { venueId, date: { gte: start, lte: end } },
      select: { date: true, timeSlot: true },
    }),
  ]);

  const slots: FeedSlot[] = [];

  // Iterate each UTC calendar day in the inclusive range.
  for (
    let cursor = new Date(start);
    cursor.getTime() <= endDay.getTime();
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1))
  ) {
    const dayKey = utcDateKey(cursor);
    const targetUTCDay = cursor.getUTCDate();

    const dayBookings = bookings.filter((b) => new Date(b.date).getUTCDate() === targetUTCDay);
    const dayBlackouts = blackouts.filter((b) => new Date(b.date).getUTCDate() === targetUTCDay);

    const fullDayBooking = dayBookings.some((b) => b.timeSlot === "FULL_DAY");
    const wholeDayBlackout = dayBlackouts.some((b) => b.timeSlot === null);
    const anyPartialBooking = dayBookings.some((b) => b.timeSlot !== "FULL_DAY");
    const anyPartialBlackout = dayBlackouts.some((b) => b.timeSlot !== null);

    for (const slot of SLOTS) {
      let status: FeedSlotStatus = "AVAILABLE";

      if (slot === "FULL_DAY") {
        // FULL_DAY is sellable only if the whole day is free of any block.
        if (wholeDayBlackout) {
          status = "BLACKOUT";
        } else if (fullDayBooking || anyPartialBooking || anyPartialBlackout) {
          status = "BOOKED";
        }
      } else {
        // Partial slot: a whole-day blackout or a slot-specific blackout wins.
        const slotBlackout = wholeDayBlackout || dayBlackouts.some((b) => b.timeSlot === slot);
        if (slotBlackout) {
          status = "BLACKOUT";
        } else if (fullDayBooking || dayBookings.some((b) => b.timeSlot === slot)) {
          status = "BOOKED";
        }
      }

      slots.push({ date: dayKey, timeSlot: slot, status });
    }
  }

  return {
    venue,
    generatedAt: new Date().toISOString(),
    from: utcDateKey(start),
    to: utcDateKey(endDay),
    slots,
  };
}

// ------------------------------------------------------------
// iCal (RFC 5545) renderer for the same occupancy data.
// ------------------------------------------------------------

// Escape text per RFC 5545 §3.3.11 (TEXT): backslash, semicolon, comma, newline.
function icalEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

// Fold lines longer than 75 octets per RFC 5545 §3.1 (continuation = CRLF + space).
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  // First chunk 75 chars, subsequent chunks 74 (one octet reserved for the leading space).
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(" " + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }
  return parts.join("\r\n");
}

// Compact UTC stamp e.g. 20260619T101500Z.
function icalStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// All-day VALUE=DATE form e.g. 20260619.
function icalDateValue(dayKey: string): string {
  return dayKey.replace(/-/g, "");
}

// Next-day for all-day DTEND (exclusive end per RFC 5545).
function nextDayValue(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return icalDateValue(utcDateKey(next));
}

/**
 * Render the venue's blocked (BOOKED/BLACKOUT) slots as an RFC 5545 VCALENDAR.
 * One VEVENT per blocked slot, no PII (SUMMARY is a neutral "Unavailable").
 * Returns null if the venue is missing/inactive (fail-closed like the JSON path).
 */
export async function buildAvailabilityICal(
  venueId: string,
  fromDate: Date,
  toDate: Date
): Promise<{ ical: string; eventCount: number; venue: { id: string; name: string } } | null> {
  const feed = await buildAvailabilityJson(venueId, fromDate, toDate);
  if (!feed) return null;

  const dtstamp = icalStamp(new Date());
  const blocked = feed.slots.filter((s) => s.status !== "AVAILABLE");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Veloria//OTA Availability Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icalEscape(feed.venue.name + " — Availability")}`,
  ];

  for (const slot of blocked) {
    // Stable, unguessable-but-deterministic UID so re-imports update rather than duplicate.
    const uid = `${venueId}-${slot.date}-${slot.timeSlot}@veloria-ota`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${icalDateValue(slot.date)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDayValue(slot.date)}`);
    lines.push("SUMMARY:Unavailable");
    lines.push(`CATEGORIES:${slot.status},${slot.timeSlot}`);
    lines.push("TRANSP:OPAQUE");
    lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // Fold every line and join with CRLF as required by RFC 5545.
  const ical = lines.map(foldLine).join("\r\n") + "\r\n";

  return { ical, eventCount: blocked.length, venue: { id: feed.venue.id, name: feed.venue.name } };
}
