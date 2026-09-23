import { describe, expect, it } from "vitest";

import {
  bandLowerBound,
  describeMetaLead,
  mapMetaLead,
  parseEventDate,
  pick,
  pretty,
  UNASSIGNED_VENUE,
  venueFromAdsetName,
  type MetaLeadPayload,
} from "./field-map";

// The shape Meta actually sends for VG Birthday - Check Your Date (Qualifier v1).
const BIRTHDAY: MetaLeadPayload = {
  id: "1234567890",
  created_time: "2026-09-23T06:15:00+0000",
  form_id: "2162479238008631",
  ad_id: "111",
  ad_name: "Birthday · Static A",
  adset_id: "222",
  adset_name: "P | Bellandur | Birthday | 25-45",
  campaign_id: "52604016210827",
  campaign_name: "VG Birthday – Venue Booking System – 5 Venues",
  platform: "fb",
  field_data: [
    { name: "full_name", values: ["Asha Rao"] },
    { name: "phone_number", values: ["+919006612345"] },
    { name: "email", values: ["asha@example.com"] },
    { name: "how_many_guests_are_you_expecting?", values: ["50_-_100"] },
    { name: "what's_your_budget?", values: ["₹50,000_-_₹1_lakh"] },
    { name: "which_date_should_we_check_for_you?", values: ["19 Dec"] },
    { name: "what_do_you_need?", values: ["venue_+_décor_+_cake"] },
    { name: "when_would_you_like_to_visit?", values: ["next_week"] },
  ],
};

describe("mapMetaLead on the live birthday form", () => {
  const m = mapMetaLead(BIRTHDAY, "VG Birthday - Check Your Date (Qualifier v1)");

  it("reads the person", () => {
    expect(m.name).toBe("Asha Rao");
    expect(m.email).toBe("asha@example.com");
  });

  it("keeps the phone in the format Meta sent, digits and plus intact", () => {
    // Reformatting a number is how it stops matching the contact it belongs to.
    expect(m.phone).toBe("+919006612345");
  });

  it("reads the banded answers and tidies them for display", () => {
    expect(m.guestsText).toBe("50 - 100");
    expect(m.budget).toBe("₹50,000 - ₹1 lakh");
    expect(m.requirement).toBe("venue + décor + cake");
    expect(m.visitTiming).toBe("next week");
  });

  it("takes the lower bound of a guest band for the numeric field", () => {
    expect(m.guestCount).toBe(50);
  });

  it("keeps the date answer as written", () => {
    expect(m.eventDateText).toBe("19 Dec");
  });

  it("finds the venue in the ad set name", () => {
    expect(m.venueLabel).toBe("Bellandur");
  });

  it("is an event lead, not an owner one", () => {
    expect(m.pipeline).toBe("event");
    expect(m.isTest).toBe(false);
    expect(m.source).toBe("Facebook Lead Ad");
  });

  it("carries every answer into one note", () => {
    const note = describeMetaLead(m, BIRTHDAY);
    expect(note).toContain("Guests: 50 - 100");
    expect(note).toContain("Budget: ₹50,000 - ₹1 lakh");
    expect(note).toContain("Date: 19 Dec");
    expect(note).toContain("Venue: Bellandur");
  });
});

describe("questions the CRM has not been taught", () => {
  it("keeps an unrecognised answer instead of dropping it", () => {
    const m = mapMetaLead({
      ...BIRTHDAY,
      field_data: [
        { name: "phone_number", values: ["+919006612345"] },
        { name: "do_you_need_rooms?", values: ["yes_8_rooms"] },
      ],
    });
    expect(m.unmapped).toEqual([{ key: "do_you_need_rooms?", value: "yes_8_rooms" }]);
    expect(describeMetaLead(m, BIRTHDAY)).toContain("yes_8_rooms");
  });

  it("does not treat an identity field as an unmapped answer", () => {
    const m = mapMetaLead({
      ...BIRTHDAY,
      field_data: [
        { name: "full_name", values: ["Asha"] },
        { name: "city", values: ["Bengaluru"] },
      ],
    });
    expect(m.unmapped).toHaveLength(0);
  });

  it("survives a form with no answers at all", () => {
    const m = mapMetaLead({ id: "1", field_data: [] });
    expect(m.name).toBeNull();
    expect(m.guestCount).toBeNull();
    expect(m.venueLabel).toBe(UNASSIGNED_VENUE);
  });
});

describe("venueFromAdsetName", () => {
  it.each([
    ["P | Bellandur | Birthday", "Bellandur"],
    ["P | Hosa Road | Birthday | 25-45", "Hosa Road"],
    ["P | Indiranagar | Anything", "Indiranagar"],
  ])("reads %s as %s", (adset, venue) => {
    expect(venueFromAdsetName(adset)).toBe(venue);
  });

  it("treats the all-venues ad set as unassigned", () => {
    expect(venueFromAdsetName("R | All Venues | Retargeting")).toBe(UNASSIGNED_VENUE);
  });

  it("keeps a venue it has never heard of rather than hiding it", () => {
    expect(venueFromAdsetName("P | Whitefield | Birthday")).toBe("Whitefield");
  });

  it("is unassigned when the ad set says nothing useful", () => {
    expect(venueFromAdsetName(null)).toBe(UNASSIGNED_VENUE);
    expect(venueFromAdsetName("Broad audience")).toBe(UNASSIGNED_VENUE);
  });
});

describe("test leads", () => {
  it("spots Meta's testing tool by its placeholder answers", () => {
    const m = mapMetaLead({
      ...BIRTHDAY,
      field_data: [{ name: "full_name", values: ["<test lead: 12345>"] }],
    });
    expect(m.isTest).toBe(true);
  });

  it("treats an organic lead with no ad as a test", () => {
    const m = mapMetaLead({ ...BIRTHDAY, ad_id: undefined, is_organic: true });
    expect(m.isTest).toBe(true);
  });

  it("does not call a real paid lead a test", () => {
    expect(mapMetaLead(BIRTHDAY).isTest).toBe(false);
  });
});

describe("owner partnership forms", () => {
  it("routes them away from the event pipeline", () => {
    const m = mapMetaLead(BIRTHDAY, "VG Owner Partnership Application (Bangalore)");
    expect(m.pipeline).toBe("owner_partnership");
  });

  it("leaves every other form on the event pipeline", () => {
    expect(mapMetaLead(BIRTHDAY, "VG Birthday - Check Your Date").pipeline).toBe("event");
    expect(mapMetaLead(BIRTHDAY, null).pipeline).toBe("event");
  });
});

describe("instagram", () => {
  it("is named as its own source", () => {
    expect(mapMetaLead({ ...BIRTHDAY, platform: "ig" }).source).toBe("Instagram Lead Ad");
  });
});

describe("parseEventDate", () => {
  const now = new Date("2026-09-23T00:00:00.000Z");

  it("reads a full date", () => {
    expect(parseEventDate("2027-01-08", now)?.toISOString().slice(0, 10)).toBe("2027-01-08");
    expect(parseEventDate("8 Jan 2027", now)?.toISOString().slice(0, 10)).toBe("2027-01-08");
    expect(parseEventDate("Jan 8 2027", now)?.toISOString().slice(0, 10)).toBe("2027-01-08");
  });

  it("reads a day and month as the next time it comes round", () => {
    expect(parseEventDate("19 Dec", now)?.toISOString().slice(0, 10)).toBe("2026-12-19");
    // Already past this year, so it means next year.
    expect(parseEventDate("19 Jan", now)?.toISOString().slice(0, 10)).toBe("2027-01-19");
  });

  it("refuses to guess an ambiguous answer", () => {
    // "Jan 8 27" could be 2027 or the 27th; "12/01" could be either order.
    for (const text of ["Jan 8 27", "12/01", "next month", "asap", ""]) {
      expect(parseEventDate(text, now)).toBeNull();
    }
  });
});

describe("small helpers", () => {
  it("picks by what a key contains, not by an exact match", () => {
    const fields = [{ name: "how_many_guests_are_you_expecting?", values: ["50_-_100"] }];
    expect(pick(fields, "guest")).toBe("50_-_100");
    expect(pick(fields, "nothing")).toBeNull();
  });

  it("ignores an answer that was left blank", () => {
    expect(pick([{ name: "budget", values: [""] }], "budget")).toBeNull();
    expect(pick([{ name: "budget", values: [null] }], "budget")).toBeNull();
  });

  it("tidies underscores without touching the words", () => {
    expect(pretty("venue_+_décor")).toBe("venue + décor");
    expect(pretty(null)).toBeNull();
  });

  it("reads the lower bound of a band", () => {
    expect(bandLowerBound("50_-_100")).toBe(50);
    expect(bandLowerBound("1,000 - 1,500")).toBe(1000);
    expect(bandLowerBound("above ₹1.5 lakh")).toBe(1);
    expect(bandLowerBound("lots")).toBeNull();
  });
});
