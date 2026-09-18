import { describe, it, expect } from "vitest";
import { SLOT_HOURS, SLOT_LABEL, TIME_SLOTS } from "@/lib/sales/slot";
import {
  bookingCalendarFile,
  buildIcs,
  escapeIcsText,
  eventWindow,
  foldIcsLine,
  icsStatusForBooking,
  slotWindow,
  toIcsDate,
  toIcsIst,
  toIcsUtc,
  type EventWindow,
} from "./event-ics";

const MIN = 60_000;
const hhmm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}${String(mins % 60).padStart(2, "0")}`;
const unfold = (ics: string) => ics.replace(/\r\n /g, "");

// @db.Date for 10 Oct 2026 is stored as UTC midnight.
const DAY = Date.UTC(2026, 9, 10);
const date = new Date(DAY);
const generatedAt = new Date("2026-09-16T04:00:00.000Z");

const TIMED = TIME_SLOTS.filter((s) => SLOT_HOURS[s] !== null);
const UNTIMED = TIME_SLOTS.filter((s) => SLOT_HOURS[s] === null);

function timed(w: EventWindow) {
  if (w.allDay) throw new Error("expected a timed window");
  return w;
}

describe("slot hours come from the team's one slot definition", () => {
  it("reads every slot's hours from SLOT_HOURS, so the calendar cannot disagree with the team's screens", () => {
    for (const slot of TIME_SLOTS) {
      expect(slotWindow(slot), slot).toEqual(SLOT_HOURS[slot]);
      expect(slotWindow(slot.toLowerCase()), slot).toEqual(SLOT_HOURS[slot]);
    }
  });

  it("pins the hours the team quotes today: Afternoon 11am–3pm, Evening 5pm–10pm", () => {
    expect(slotWindow("AFTERNOON")).toEqual({ startMin: 11 * 60, endMin: 15 * 60 });
    expect(slotWindow("EVENING")).toEqual({ startMin: 17 * 60, endMin: 22 * 60 });
  });

  it("puts each timed slot's own hours in the file and names the slot by its label", () => {
    expect(TIMED.length).toBeGreaterThan(0);
    for (const slot of TIMED) {
      const hours = SLOT_HOURS[slot]!;
      const { body } = bookingCalendarFile(
        { id: "bk", bookingNumber: "VG-1", eventName: "Reception", status: "CONFIRMED", date, timeSlot: slot },
        { generatedAt }
      );
      const text = unfold(body);
      expect(text).toContain(`DTSTART;TZID=Asia/Kolkata:20261010T${hhmm(hours.startMin)}00`);
      expect(text).toContain(`DTEND;TZID=Asia/Kolkata:20261010T${hhmm(hours.endMin)}00`);
      expect(text).toContain(`Times shown are your booked slot: ${escapeIcsText(SLOT_LABEL[slot])}.`);
    }
  });

  it("writes an all-day entry, never made-up hours, for a slot without hours", () => {
    for (const slot of [...UNTIMED, null, "BRUNCH"]) {
      expect(slotWindow(slot)).toBeNull();
      expect(eventWindow({ date, timeSlot: slot })).toEqual({ allDay: true, day: date });
    }
    for (const slot of UNTIMED) {
      const text = unfold(
        bookingCalendarFile(
          { id: "bk", bookingNumber: "VG-2", eventName: "Naming ceremony", status: "CONFIRMED", date, timeSlot: slot },
          { generatedAt }
        ).body
      );
      expect(text).toContain("DTSTART;VALUE=DATE:20261010");
      expect(text).toContain("DTEND;VALUE=DATE:20261011");
      expect(text).not.toContain("TZID=Asia/Kolkata:2026");
      expect(text).toContain(`Booked slot: ${escapeIcsText(SLOT_LABEL[slot])}.`);
      expect(text).toContain("so this is an all-day entry.");
    }
  });
});

describe("eventWindow (IST)", () => {
  it("falls back to the booked slot's hours on the event's own IST calendar day", () => {
    const hours = SLOT_HOURS.EVENING!;
    const w = timed(eventWindow({ date, timeSlot: "EVENING" }));
    expect(w.source).toBe("slot");
    expect(w.start.getTime()).toBe(DAY + (hours.startMin - 330) * MIN);
    expect(w.end?.getTime()).toBe(DAY + (hours.endMin - 330) * MIN);
    expect(toIcsIst(w.start)).toBe(`20261010T${hhmm(hours.startMin)}00`);
  });

  it("accepts the date as an ISO string and only uses its UTC calendar day", () => {
    const a = timed(eventWindow({ date: "2026-10-10T00:00:00.000Z", timeSlot: "EVENING" }));
    const b = timed(eventWindow({ date: new Date("2026-10-10T18:29:00.000Z"), timeSlot: "EVENING" }));
    expect(a.start.toISOString()).toBe(b.start.toISOString());
    expect(eventWindow({ date: "2026-10-10T18:29:00.000Z", timeSlot: null })).toEqual({ allDay: true, day: date });
  });

  it("prefers the team's event window (startTime / endTime) when set", () => {
    const w = timed(
      eventWindow({
        date,
        timeSlot: "EVENING",
        startTime: new Date("2026-10-10T12:30:00.000Z"), // 6:00 pm IST
        endTime: "2026-10-10T17:00:00.000Z", // 10:30 pm IST
        eventStartAt: new Date("2026-10-10T13:30:00.000Z"),
      })
    );
    expect(w.source).toBe("booking");
    expect(toIcsIst(w.start)).toBe("20261010T180000");
    expect(w.end && toIcsIst(w.end)).toBe("20261010T223000");
  });

  it("uses the handover start when there is no booking start, ending with the slot", () => {
    const hours = SLOT_HOURS.EVENING!;
    const w = timed(eventWindow({ date, timeSlot: "EVENING", eventStartAt: "2026-10-10T12:30:00.000Z" })); // 6:00 pm IST
    expect(w.source).toBe("handover");
    expect(toIcsIst(w.start)).toBe("20261010T180000");
    expect(w.end?.getTime()).toBe(DAY + (hours.endMin - 330) * MIN);
  });

  it("never ends before it starts", () => {
    const hours = SLOT_HOURS.EVENING!;
    const late = new Date(DAY + (hours.endMin - 330) * MIN + 30 * MIN); // after the slot ends
    const w = timed(eventWindow({ date, timeSlot: "EVENING", startTime: late, endTime: "2026-10-10T08:00:00.000Z" }));
    expect(w.end!.getTime()).toBeGreaterThan(w.start.getTime());
    expect(w.end!.getTime() - w.start.getTime()).toBe((hours.endMin - hours.startMin) * MIN);
  });

  it("leaves the end out when nothing records it, rather than guessing", () => {
    const handover = timed(eventWindow({ date, timeSlot: null, eventStartAt: "2026-10-10T04:00:00.000Z" })); // 9:30 am IST
    expect(handover).toMatchObject({ source: "handover", end: null });
    expect(toIcsIst(handover.start)).toBe("20261010T093000");
    const badEnd = timed(
      eventWindow({ date, timeSlot: null, startTime: "2026-10-10T04:00:00.000Z", endTime: "2026-10-10T03:00:00.000Z" })
    );
    expect(badEnd).toMatchObject({ source: "booking", end: null });
  });

  it("rejects a booking without a valid date", () => {
    expect(() => eventWindow({ date: "not a date", timeSlot: "EVENING" })).toThrow();
  });
});

describe("ICS text", () => {
  it("formats UTC and IST stamps, rolling past midnight", () => {
    expect(toIcsUtc(new Date("2026-10-10T11:30:00.000Z"))).toBe("20261010T113000Z");
    expect(toIcsIst(new Date("2026-10-10T11:30:00.000Z"))).toBe("20261010T170000");
    expect(toIcsIst(new Date("2026-10-10T19:00:00.000Z"))).toBe("20261011T003000");
  });

  it("formats all-day dates from the UTC calendar day", () => {
    expect(toIcsDate(new Date("2026-10-10T00:00:00.000Z"))).toBe("20261010");
    expect(toIcsDate(new Date("2026-12-31T23:59:00.000Z"))).toBe("20261231");
  });

  it("escapes TEXT values", () => {
    expect(escapeIcsText("a,b;c\\d\ne\r\nf")).toBe("a\\,b\\;c\\\\d\\ne\\nf");
  });

  it("folds long lines at 75 octets without splitting a character", () => {
    const line = `DESCRIPTION:${"Priya & Rahul · ₹2,40,000 · 🎉 ".repeat(8)}`;
    const folded = foldIcsLine(line);
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(1);
    for (const [i, p] of physical.entries()) {
      expect(Buffer.byteLength(p, "utf8")).toBeLessThanOrEqual(75);
      if (i > 0) expect(p.startsWith(" ")).toBe(true);
      expect(p.includes("�")).toBe(false);
    }
    expect(unfold(folded)).toBe(line);
    expect(foldIcsLine("SUMMARY:short")).toBe("SUMMARY:short");
  });
});

describe("buildIcs", () => {
  const base = {
    uid: "booking-abc@veloriagrand.com",
    start: new Date("2026-10-10T11:30:00.000Z"),
    end: new Date("2026-10-10T17:30:00.000Z"),
    title: "Sangeet, family; friends",
    generatedAt,
  };

  it("writes a well-formed VCALENDAR with CRLF line endings and IST times", () => {
    const ics = buildIcs({ ...base, location: "Grand Hall, Bengaluru", description: "Line one\nLine two", url: "https://app.example.com/app/event", status: "TENTATIVE" });
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(/[^\r]\n/.test(ics)).toBe(false);
    const lines = unfold(ics).split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("TZID:Asia/Kolkata");
    expect(lines).toContain("TZOFFSETTO:+0530");
    expect(lines).toContain("DTSTAMP:20260916T040000Z");
    expect(lines).toContain("DTSTART;TZID=Asia/Kolkata:20261010T170000");
    expect(lines).toContain("DTEND;TZID=Asia/Kolkata:20261010T230000");
    expect(lines).toContain("SUMMARY:Sangeet\\, family\\; friends");
    expect(lines).toContain("LOCATION:Grand Hall\\, Bengaluru");
    expect(lines).toContain("DESCRIPTION:Line one\\nLine two");
    expect(lines).toContain("URL:https://app.example.com/app/event");
    expect(lines).toContain("STATUS:TENTATIVE");
    expect(lines.filter((l) => l.startsWith("BEGIN:")).length).toBe(lines.filter((l) => l.startsWith("END:")).length);
  });

  it("writes an all-day entry as VALUE=DATE, ending the next day", () => {
    const lines = unfold(buildIcs({ ...base, start: new Date("2026-12-31T00:00:00.000Z"), end: null, allDay: true })).split("\r\n");
    expect(lines).toContain("DTSTART;VALUE=DATE:20261231");
    expect(lines).toContain("DTEND;VALUE=DATE:20270101");
    expect(lines.some((l) => l.startsWith("DTSTART;TZID"))).toBe(false);
  });

  it("leaves DTEND out when the end is unknown", () => {
    const lines = unfold(buildIcs({ ...base, end: null })).split("\r\n");
    expect(lines).toContain("DTSTART;TZID=Asia/Kolkata:20261010T170000");
    expect(lines.some((l) => l.startsWith("DTEND"))).toBe(false);
  });

  it("strips anything unsafe from the UID and URL, and defaults to CONFIRMED", () => {
    const lines = unfold(buildIcs({ ...base, uid: "booking-a b\r\nX:1@x.com", url: "https://x.com/a\r\nATTACH:evil" })).split("\r\n");
    expect(lines).toContain("UID:booking-abX1@x.com");
    expect(lines).toContain("URL:https://x.com/aATTACH:evil");
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines.some((l) => l.startsWith("ATTACH"))).toBe(false);
  });

  it("refuses a timed event that ends before it starts", () => {
    expect(() => buildIcs({ ...base, end: base.start })).toThrow();
  });
});

describe("bookingCalendarFile", () => {
  it("builds the customer's event file with an honest status", () => {
    const { filename, body } = bookingCalendarFile(
      {
        id: "bk_1",
        bookingNumber: "VG/B 0042",
        eventName: "Aarav's First Birthday",
        status: "HOLD",
        date: new Date("2026-10-10T00:00:00.000Z"),
        timeSlot: "AFTERNOON",
        venueName: "Veloria Grand — Banashankari",
        venueAddress: "14th Cross, Bengaluru",
      },
      { generatedAt, appUrl: "https://app.example.com/" }
    );
    expect(filename).toBe("veloria-VG-B-0042.ics");
    const text = unfold(body);
    expect(text).toContain("SUMMARY:Aarav's First Birthday · Veloria Grand");
    expect(text).toContain("LOCATION:Veloria Grand — Banashankari\\, 14th Cross\\, Bengaluru");
    expect(text).toContain("STATUS:TENTATIVE");
    expect(text).toContain("Booking VG/B 0042 · Date on hold");
    expect(text).toContain(`Times shown are your booked slot: ${escapeIcsText(SLOT_LABEL.AFTERNOON)}.`);
    expect(text).toContain("URL:https://app.example.com/app/event");
    expect(text).toContain("UID:booking-bk_1@veloriagrand.com");
  });

  it("does not call a team-entered time the slot's hours", () => {
    const { body } = bookingCalendarFile(
      {
        id: "bk_2",
        bookingNumber: "VG-B-0043",
        eventName: "Reception",
        status: "CONFIRMED",
        date: "2026-11-02T00:00:00.000Z",
        timeSlot: "EVENING",
        startTime: "2026-11-02T13:00:00.000Z",
        endTime: "2026-11-02T17:00:00.000Z",
      },
      { generatedAt }
    );
    const text = unfold(body);
    expect(text).toContain("STATUS:CONFIRMED");
    expect(text).toContain("DTSTART;TZID=Asia/Kolkata:20261102T183000");
    expect(text).toContain("DTEND;TZID=Asia/Kolkata:20261102T223000");
    expect(text).not.toContain("booked slot");
    expect(text).not.toContain("all-day");
    expect(text).not.toContain("URL:");
  });

  it("says so when the booking has a start but no end", () => {
    const { body } = bookingCalendarFile(
      { id: "bk_3", bookingNumber: "VG-B-0044", eventName: "Puja", status: "CONFIRMED", date, timeSlot: null, eventStartAt: "2026-10-10T04:00:00.000Z" },
      { generatedAt }
    );
    const text = unfold(body);
    expect(text).toContain("DTSTART;TZID=Asia/Kolkata:20261010T093000");
    expect(text).not.toContain("DTEND");
    expect(text).toContain("No end time is set on this booking yet.");
  });

  it("maps booking statuses to calendar statuses", () => {
    expect(icsStatusForBooking("HOLD")).toBe("TENTATIVE");
    expect(icsStatusForBooking("TENTATIVE")).toBe("TENTATIVE");
    expect(icsStatusForBooking("CONFIRMED")).toBe("CONFIRMED");
    expect(icsStatusForBooking("IN_PROGRESS")).toBe("CONFIRMED");
    expect(icsStatusForBooking("COMPLETED")).toBe("CONFIRMED");
    expect(icsStatusForBooking("CANCELLED")).toBe("CANCELLED");
  });
});
