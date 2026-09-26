import { describe, expect, it } from "vitest";

import {
  buildConversionRows,
  formatIst,
  QUALIFIED_CONVERSION,
  QUALIFIED_VALUE,
  toFeedCsv,
  WON_CONVERSION,
  type FeedLead,
} from "./gads-conversion-feed";
import {
  mapLeadFormAnswers,
  parseAnswerDate,
  parseGuestCount,
  prettifyAnswer,
} from "./lead-form-answers";
import {
  stampsForStatus,
  validateLeadStatusChange,
} from "./lead-status-rules";

// ---- section 3: what Qualified and Won are allowed to mean ---------------

const complete = {
  eventDate: new Date("2026-12-01"),
  guestCount: 200,
  eventType: "Wedding",
  locationConfirmed: true,
  bookingValue: 145000,
};

describe("validateLeadStatusChange", () => {
  it("allows Qualified when all four facts are there", () => {
    expect(validateLeadStatusChange("QUALIFIED", complete).ok).toBe(true);
  });

  it.each([
    ["eventDate", { eventDate: null }, "event date"],
    ["eventType", { eventType: "" }, "event type"],
    ["locationConfirmed", { locationConfirmed: false }, "Hosa Road"],
  ])("refuses Qualified without %s", (_label, override, expected) => {
    const res = validateLeadStatusChange("QUALIFIED", { ...complete, ...override });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(expected);
  });

  it("refuses Qualified below the 50-guest floor, and allows exactly 50", () => {
    expect(validateLeadStatusChange("QUALIFIED", { ...complete, guestCount: 49 }).ok).toBe(false);
    expect(validateLeadStatusChange("QUALIFIED", { ...complete, guestCount: 50 }).ok).toBe(true);
    expect(validateLeadStatusChange("QUALIFIED", { ...complete, guestCount: null }).ok).toBe(false);
  });

  it("names every missing field at once, so one fix does not reveal the next", () => {
    const res = validateLeadStatusChange("QUALIFIED", {
      eventDate: null,
      guestCount: null,
      eventType: null,
      locationConfirmed: false,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("event date");
      expect(res.error).toContain("guest count");
      expect(res.error).toContain("event type");
      expect(res.error).toContain("Hosa Road");
    }
  });

  it("requires a booking value for Won, and accepts a Decimal-like object", () => {
    expect(validateLeadStatusChange("WON", { ...complete, bookingValue: null }).ok).toBe(false);
    expect(validateLeadStatusChange("WON", { ...complete, bookingValue: 0 }).ok).toBe(false);
    expect(
      validateLeadStatusChange("WON", { bookingValue: { toString: () => "145000" } }).ok
    ).toBe(true);
  });

  it("does not gate the other statuses — recording what happened stays free", () => {
    for (const status of ["NEW", "NOT_CONNECTED", "CONTACTED", "PROPOSAL_SENT", "NEGOTIATION", "LOST"]) {
      expect(validateLeadStatusChange(status, { eventDate: null, guestCount: null }).ok).toBe(true);
    }
  });
});

// ---- the timestamps Google is told about --------------------------------

describe("stampsForStatus", () => {
  const now = new Date("2026-09-24T10:02:10.000Z");

  it("stamps qualifiedAt the first time only", () => {
    expect(stampsForStatus("QUALIFIED", {}, now)).toEqual({ qualifiedAt: now });
    const earlier = new Date("2026-09-01T00:00:00.000Z");
    expect(stampsForStatus("QUALIFIED", { qualifiedAt: earlier }, now)).toEqual({});
  });

  it("never moves a stamp that already exists — a re-Won lead is not a second booking", () => {
    const first = new Date("2026-09-02T00:00:00.000Z");
    expect(stampsForStatus("WON", { qualifiedAt: first, wonAt: first }, now)).toEqual({});
  });

  it("gives a lead taken straight to Won both stamps at the same instant", () => {
    const stamps = stampsForStatus("WON", {}, now);
    expect(stamps.wonAt).toEqual(now);
    expect(stamps.qualifiedAt).toEqual(now);
  });

  it("keeps an existing qualifiedAt when the lead is later won", () => {
    const qualified = new Date("2026-09-10T00:00:00.000Z");
    expect(stampsForStatus("WON", { qualifiedAt: qualified }, now)).toEqual({ wonAt: now });
  });

  it("writes nothing for statuses that are not conversions", () => {
    expect(stampsForStatus("CONTACTED", {}, now)).toEqual({});
    expect(stampsForStatus("LOST", {}, now)).toEqual({});
  });
});

// ---- section 4: what reaches the feed ------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-24T12:00:00.000Z");

function lead(over: Partial<FeedLead> = {}): FeedLead {
  return {
    id: "lead1",
    createdAt: new Date(now.getTime() - 10 * DAY),
    qualifiedAt: new Date(now.getTime() - 5 * DAY),
    wonAt: null,
    bookingValue: null,
    gclid: "CjwKCAjw",
    ...over,
  };
}

describe("buildConversionRows", () => {
  it("emits one qualified row at the fixed value", () => {
    const rows = buildConversionRows([lead()], { now });
    expect(rows).toHaveLength(1);
    expect(rows[0].conversionName).toBe(QUALIFIED_CONVERSION);
    expect(rows[0].value).toBe(QUALIFIED_VALUE);
    expect(rows[0].currency).toBe("INR");
  });

  it("emits the booking row at the actual booking value", () => {
    const rows = buildConversionRows(
      [lead({ wonAt: new Date(now.getTime() - DAY), bookingValue: 145000 })],
      { now }
    );
    expect(rows).toHaveLength(2);
    const won = rows.find((r) => r.conversionName === WON_CONVERSION);
    expect(won?.value).toBe(145000);
  });

  it("skips a lead with no click id — there is nothing to attribute it to", () => {
    expect(buildConversionRows([lead({ gclid: null })], { now })).toHaveLength(0);
    expect(buildConversionRows([lead({ gclid: "   " })], { now })).toHaveLength(0);
  });

  it("drops a conversion in the future", () => {
    const rows = buildConversionRows([lead({ qualifiedAt: new Date(now.getTime() + DAY) })], { now });
    expect(rows).toHaveLength(0);
  });

  it("drops a conversion dated before the lead itself existed", () => {
    const created = new Date(now.getTime() - 3 * DAY);
    const rows = buildConversionRows(
      [lead({ createdAt: created, qualifiedAt: new Date(created.getTime() - DAY) })],
      { now }
    );
    expect(rows).toHaveLength(0);
  });

  it("drops a conversion more than 90 days after the click", () => {
    const created = new Date(now.getTime() - 200 * DAY);
    const rows = buildConversionRows(
      [lead({ createdAt: created, qualifiedAt: new Date(created.getTime() + 91 * DAY) })],
      { now, windowDays: 3650 }
    );
    expect(rows).toHaveLength(0);
  });

  it("lists only the last 30 days by default", () => {
    const old = new Date(now.getTime() - 31 * DAY);
    expect(
      buildConversionRows([lead({ createdAt: new Date(now.getTime() - 40 * DAY), qualifiedAt: old })], { now })
    ).toHaveLength(0);
  });

  it("refuses to tell Google a booking was worth nothing", () => {
    const rows = buildConversionRows(
      [lead({ qualifiedAt: null, wonAt: new Date(now.getTime() - DAY), bookingValue: 0 })],
      { now }
    );
    expect(rows).toHaveLength(0);
  });

  it("keeps the qualified row for a lead that was later lost — status is not consulted", () => {
    // The feed reads timestamps, not the current status: a lead that qualified
    // and then went cold still taught Google something true.
    const rows = buildConversionRows([lead()], { now });
    expect(rows).toHaveLength(1);
  });
});

describe("formatIst", () => {
  it("renders IST, not UTC", () => {
    expect(formatIst(new Date("2026-09-24T10:02:10.000Z"))).toBe("2026-09-24 15:32:10");
  });

  it("rolls the date over in the evening", () => {
    expect(formatIst(new Date("2026-09-24T19:30:00.000Z"))).toBe("2026-09-25 01:00:00");
  });
});

describe("toFeedCsv", () => {
  it("writes the exact file Google expects", () => {
    const rows = buildConversionRows(
      [lead({ qualifiedAt: new Date("2026-09-24T10:02:10.000Z") })],
      { now: new Date("2026-09-24T12:00:00.000Z") }
    );
    const csv = toFeedCsv(rows);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("Parameters:TimeZone=Asia/Calcutta");
    expect(lines[1]).toBe(
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency"
    );
    expect(lines[2]).toBe("CjwKCAjw,CRM - Qualified lead,2026-09-24 15:32:10,5000,INR");
    expect(csv.includes("\n\n")).toBe(false); // a blank line aborts Google's parse
  });

  it("still produces a valid file with no rows", () => {
    expect(toFeedCsv([]).trimEnd().split("\n")).toHaveLength(2);
  });
});

// ---- section 2: the answers the webhooks used to drop --------------------

describe("mapLeadFormAnswers", () => {
  it("maps the three fields a lead is judged on", () => {
    const mapped = mapLeadFormAnswers([
      { key: "FULL_NAME", value: "Asha" },
      { key: "event_date", value: "14/11/2026" },
      { key: "number_of_guests", value: "250" },
      { key: "event_type", value: "wedding_ceremony_/_reception" },
    ]);
    expect(mapped.eventDate?.toISOString().slice(0, 10)).toBe("2026-11-14");
    expect(mapped.guestCount).toBe(250);
    expect(mapped.eventType).toBe("Wedding Ceremony / Reception");
    expect(mapped.unmapped).toHaveLength(0);
  });

  it("keeps answers it cannot place instead of dropping them", () => {
    const mapped = mapLeadFormAnswers([{ key: "budget_range", value: "5-7 lakh" }]);
    expect(mapped.unmapped).toEqual([{ key: "budget_range", value: "5-7 lakh" }]);
  });

  it("ignores the identity columns the webhook already handles", () => {
    const mapped = mapLeadFormAnswers([
      { key: "EMAIL", value: "a@b.com" },
      { key: "PHONE_NUMBER", value: "9611360491" },
      { key: "POSTAL_CODE", value: "560103" },
    ]);
    expect(mapped.unmapped).toHaveLength(0);
    expect(mapped.eventType).toBeNull();
  });

  it("reads a guest range as its lower bound", () => {
    expect(parseGuestCount("100-200")).toBe(100);
    expect(parseGuestCount("approx 250 guests")).toBe(250);
    expect(parseGuestCount("lots")).toBeNull();
  });

  it("reads the date formats these forms actually send", () => {
    expect(parseAnswerDate("2026-11-14")?.toISOString().slice(0, 10)).toBe("2026-11-14");
    expect(parseAnswerDate("14-11-2026")?.toISOString().slice(0, 10)).toBe("2026-11-14");
    expect(parseAnswerDate("November 14, 2026")?.toISOString().slice(0, 10)).toBe("2026-11-14");
    expect(parseAnswerDate("next summer")).toBeNull();
  });

  it("makes an answer readable without inventing words", () => {
    expect(prettifyAnswer("birthday_party")).toBe("Birthday Party");
  });
});
