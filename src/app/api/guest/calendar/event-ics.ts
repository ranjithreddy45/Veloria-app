// ============================================================
// Add to calendar — pure .ics builder for a customer's event.
// ------------------------------------------------------------
// No I/O: the calendar route only feeds it booking fields, so every rule here
// is unit-tested (event-ics.test.ts).
//
// When does the event happen? In the order the team records it:
//   1. booking.startTime / endTime — the "Event window" on the team's booking page
//   2. booking.eventStartAt        — the precise start set at the ops handover
//   3. the slot's hours, from the team's one slot definition (SLOT_HOURS in
//      src/lib/sales/slot.ts: the hours the team's screens, quotations and
//      messages show)
// Nothing is guessed: a slot the team has set no hours for becomes an all-day
// entry on the event's day, and an end time nobody recorded is left out.
// booking.date is @db.Date: UTC midnight of the event's calendar day in IST.
//
// Output follows RFC 5545: CRLF line endings, escaped TEXT values, lines folded
// at 75 octets (never inside a UTF-8 character), local times in
// TZID=Asia/Kolkata with an explicit VTIMEZONE (IST has no daylight saving),
// and all-day entries as VALUE=DATE.
// ============================================================

import { BOOKING_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import { SLOT_HOURS, SLOT_LABEL, toTimeSlot, type SlotHours } from "@/lib/sales/slot";

export const IST_OFFSET_MINUTES = 330;
const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
const DAY_MS = DAY_MINUTES * MINUTE_MS;

/** The team's hours for a booking's slot (IST), or null when the slot has none or is unknown. */
export function slotWindow(timeSlot: string | null | undefined): SlotHours | null {
  const slot = toTimeSlot(timeSlot);
  return slot ? SLOT_HOURS[slot] : null;
}

export interface EventTiming {
  /** booking.date (@db.Date → UTC midnight of the IST calendar day). */
  date: Date | string;
  timeSlot?: string | null;
  /** booking.startTime / endTime: absolute instants entered by the team. */
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  /** booking.eventStartAt: precise start set at handover. */
  eventStartAt?: Date | string | null;
}

export type EventWindow =
  | {
      allDay: false;
      start: Date;
      /** null when neither the booking nor its slot says when the event ends. */
      end: Date | null;
      /** Where the start time came from, so the file can say when it is the slot's hours. */
      source: "booking" | "handover" | "slot";
    }
  | {
      /** No start time is recorded anywhere: an all-day entry on the event's day. */
      allDay: true;
      /** UTC midnight of the event's IST calendar day (booking.date's day). */
      day: Date;
    };

function asDate(v: Date | string | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? new Date(v.getTime()) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function eventWindow(t: EventTiming): EventWindow {
  const date = asDate(t.date);
  if (!date) throw new Error("eventWindow: the booking has no valid date");
  const dayUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  const hours = slotWindow(t.timeSlot);
  const slotStart = hours ? new Date(dayUtc + (hours.startMin - IST_OFFSET_MINUTES) * MINUTE_MS) : null;
  const slotEnd = hours
    ? new Date(
        dayUtc +
          ((hours.endMin > hours.startMin ? hours.endMin : hours.endMin + DAY_MINUTES) - IST_OFFSET_MINUTES) * MINUTE_MS
      )
    : null;

  const bookingStart = asDate(t.startTime);
  const handoverStart = asDate(t.eventStartAt);
  const start = bookingStart ?? handoverStart ?? slotStart;
  if (!start) return { allDay: true, day: new Date(dayUtc) };
  const source = bookingStart ? "booking" : handoverStart ? "handover" : "slot";

  const bookingEnd = asDate(t.endTime);
  let end: Date | null = null;
  if (bookingEnd && bookingEnd.getTime() > start.getTime()) {
    end = bookingEnd;
  } else if (slotStart && slotEnd) {
    // A start already past the slot's end keeps the slot's length instead of ending before it starts.
    end =
      slotEnd.getTime() > start.getTime()
        ? slotEnd
        : new Date(start.getTime() + (slotEnd.getTime() - slotStart.getTime()));
  }
  return { allDay: false, start, end, source };
}

// ------------------------------------------------------------ RFC 5545 text

const pad2 = (n: number) => String(n).padStart(2, "0");

function stamp(d: Date, offsetMinutes: number): string {
  const t = new Date(d.getTime() + offsetMinutes * MINUTE_MS);
  return (
    `${t.getUTCFullYear()}${pad2(t.getUTCMonth() + 1)}${pad2(t.getUTCDate())}` +
    `T${pad2(t.getUTCHours())}${pad2(t.getUTCMinutes())}${pad2(t.getUTCSeconds())}`
  );
}

/** 20261010T113000Z */
export function toIcsUtc(d: Date): string {
  return `${stamp(d, 0)}Z`;
}

/** Local IST wall-clock time for a TZID=Asia/Kolkata property: 20261010T170000 */
export function toIcsIst(d: Date): string {
  return stamp(d, IST_OFFSET_MINUTES);
}

/** The UTC calendar date for an all-day VALUE=DATE property: 20261010 */
export function toIcsDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/** Fold a content line at 75 octets; continuation lines start with one space. */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const chunks: string[] = [];
  let chunk = "";
  let size = 0;
  let limit = 75;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    if (size + n > limit) {
      chunks.push(chunk);
      chunk = "";
      size = 0;
      limit = 74; // the leading space of a continuation line is the 75th octet
    }
    chunk += ch;
    size += n;
  }
  chunks.push(chunk);
  return chunks.join("\r\n ");
}

export type IcsStatus = "CONFIRMED" | "TENTATIVE" | "CANCELLED";

export interface IcsEvent {
  uid: string;
  /** A timed event's start. For an all-day entry, any instant on the day: its UTC calendar date is used. */
  start: Date;
  /** Timed events only. Leave out when the end is unknown: the file then has no DTEND. */
  end?: Date | null;
  /** An all-day entry on start's UTC calendar date. */
  allDay?: boolean;
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  status?: IcsStatus;
  /** DTSTAMP — when this file was generated. */
  generatedAt: Date;
}

export function buildIcs(ev: IcsEvent): string {
  if (!ev.allDay && ev.end && !(ev.end.getTime() > ev.start.getTime())) {
    throw new Error("buildIcs: the event must end after it starts");
  }
  const uid = ev.uid.replace(/[^A-Za-z0-9@._-]/g, "");
  const url = ev.url ? ev.url.replace(/[\r\n\s]/g, "") : null;
  const when = ev.allDay
    ? [`DTSTART;VALUE=DATE:${toIcsDate(ev.start)}`, `DTEND;VALUE=DATE:${toIcsDate(new Date(ev.start.getTime() + DAY_MS))}`]
    : [
        `DTSTART;TZID=Asia/Kolkata:${toIcsIst(ev.start)}`,
        ...(ev.end ? [`DTEND;TZID=Asia/Kolkata:${toIcsIst(ev.end)}`] : []),
      ];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Veloria Grand//Customer App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Kolkata",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0530",
    "TZOFFSETTO:+0530",
    "TZNAME:IST",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(ev.generatedAt)}`,
    ...when,
    `SUMMARY:${escapeIcsText(ev.title)}`,
    ...(ev.location ? [`LOCATION:${escapeIcsText(ev.location)}`] : []),
    ...(ev.description ? [`DESCRIPTION:${escapeIcsText(ev.description)}`] : []),
    ...(url ? [`URL:${url}`] : []),
    `STATUS:${ev.status ?? "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

// ------------------------------------------------------------ booking → file

export interface BookingCalendarSource extends EventTiming {
  id: string;
  bookingNumber: string;
  eventName: string;
  status: string;
  venueName?: string | null;
  venueAddress?: string | null;
}

/** A hold is not a confirmed event yet, and the calendar should say so. */
export function icsStatusForBooking(status: string): IcsStatus {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "HOLD" || status === "TENTATIVE") return "TENTATIVE";
  return "CONFIRMED";
}

export function bookingCalendarFile(
  b: BookingCalendarSource,
  opts: { generatedAt: Date; appUrl?: string | null }
): { filename: string; body: string } {
  const w = eventWindow(b);
  const app = opts.appUrl ? `${opts.appUrl.replace(/\/+$/, "")}/app/event` : null;
  const slot = toTimeSlot(b.timeSlot);
  const timing = w.allDay
    ? [slot ? `Booked slot: ${SLOT_LABEL[slot]}.` : null, "No times are set on this booking yet, so this is an all-day entry."]
    : [
        w.source === "slot" && slot ? `Times shown are your booked slot: ${SLOT_LABEL[slot]}.` : null,
        w.end ? null : "No end time is set on this booking yet.",
      ];
  const description = [
    `Booking ${b.bookingNumber} · ${customerLabel(BOOKING_STATUS_LABEL, b.status)}`,
    ...timing,
    app ? `Your event in the Veloria Grand app: ${app}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const body = buildIcs({
    uid: `booking-${b.id}@veloriagrand.com`,
    ...(w.allDay ? { start: w.day, allDay: true } : { start: w.start, end: w.end }),
    title: `${b.eventName} · Veloria Grand`,
    location: [b.venueName, b.venueAddress].filter(Boolean).join(", ") || null,
    description,
    url: app,
    status: icsStatusForBooking(b.status),
    generatedAt: opts.generatedAt,
  });
  const safeNumber = b.bookingNumber.replace(/[^A-Za-z0-9._-]+/g, "-") || "event";
  return { filename: `veloria-${safeNumber}.ics`, body };
}
