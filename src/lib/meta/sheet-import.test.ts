import { describe, it, expect } from "vitest";
import { describeTeamNotes, ownerFirstName, sheetRowToLead, statusFromRemarks } from "./sheet-import";
import { eventTypeFromAdNames, mapMetaLead } from "./field-map";

// A row in the shape of the "Leads Sheet" Meta fills (fake person).
const ROW = {
  id: "l:1130968716276590",
  created_time: "2026-10-01T12:09:25-05:00",
  ad_id: "ag:52605547800427",
  ad_name: "Birthday Ads - Indiranagar",
  adset_id: "as:52604020310627",
  adset_name: "P | Indiranagar | Birthday Catchment",
  campaign_id: "c:52604016210827",
  campaign_name: "VG Birthday - Venue Booking System - 5 Venues",
  form_id: "f:4231736586970747",
  form_name: "VG Birthday - Check Your Date (Qualifier v1)",
  is_organic: "false",
  platform: "ig",
  "how_many_guests_are_you_expecting?": "50_-_100",
  "what_do_you_need_from_us?": "venue_+_food",
  which_event_date_should_we_check_for_you: "19 Dec",
  full_name: "Test Person",
  phone_number: "p:+919000000001",
  lead_status: "CREATED",
  "Lead Owner": "Meera-Nayana",
  Remarks: "RNR",
  "Property details Shared?": "Indiranagar",
  "Expected Date of closure ": "",
  status: "",
};

describe("sheetRowToLead", () => {
  it("turns a sheet row into a Graph-style payload, prefixes stripped and time in UTC", () => {
    const r = sheetRowToLead(ROW)!;
    expect(r.payload).toMatchObject({
      id: "1130968716276590",
      created_time: "2026-10-01T17:09:25.000Z",
      ad_id: "52605547800427",
      adset_id: "52604020310627",
      campaign_id: "52604016210827",
      form_id: "4231736586970747",
      form_name: "VG Birthday - Check Your Date (Qualifier v1)",
      platform: "ig",
      is_organic: false,
    });
    const fields = Object.fromEntries(r.payload.field_data!.map((f) => [f.name, f.values?.[0]]));
    expect(fields.phone_number).toBe("+919000000001");
    expect(fields.full_name).toBe("Test Person");
    expect(fields["how_many_guests_are_you_expecting?"]).toBe("50_-_100");
    // Meta's own stage and the team's columns are not answers.
    expect(fields.lead_status).toBeUndefined();
    expect(fields["Lead Owner"]).toBeUndefined();
    expect(r.team).toEqual({ owner: "Meera-Nayana", remarks: "RNR", propertyShared: "Indiranagar" });
  });

  it("drops Meta's permission notice instead of storing it as a campaign name", () => {
    const r = sheetRowToLead({
      ...ROW,
      campaign_name: "You don't have enough permissions. Please refer to this help page: https://www.facebook.com/business/help/766393076839635",
    })!;
    expect(r.payload.campaign_name).toBeUndefined();
  });

  it("skips a row without a lead id", () => {
    expect(sheetRowToLead({ ...ROW, id: "" })).toBeNull();
  });

  it("maps cleanly: Birthday from the campaign name, guests and venue from the answers", () => {
    const { payload } = sheetRowToLead(ROW)!;
    const m = mapMetaLead(payload, payload.form_name, new Date(payload.created_time!));
    expect(m.eventType).toBe("Birthday");
    expect(m.guestCount).toBe(50);
    expect(m.phone).toBe("+919000000001");
    expect(m.venueLabel).toBe("Indiranagar");
    expect(m.eventDate?.toISOString().slice(0, 10)).toBe("2026-12-19");
  });
});

describe("eventTypeFromAdNames", () => {
  it("reads the occasion from campaign, ad set, ad or form — only clear words", () => {
    expect(eventTypeFromAdNames({ campaign_name: "VG Birthday - 5 Venues" })).toBe("Birthday");
    expect(eventTypeFromAdNames({ campaign_name: "Yelahanka Leads", adset_name: "Wedding lead Gen" })).toBe("Wedding");
    expect(eventTypeFromAdNames({ campaign_name: "Yelahanka Leads" }, "Banquet | Basic")).toBeNull();
  });

  it("never overrides the form's own answer", () => {
    const m = mapMetaLead(
      { campaign_name: "VG Birthday", field_data: [{ name: "what_type_of_event_are_you_planning?", values: ["engagement_/_pre-wedding_function"] }] },
      null
    );
    expect(m.eventType).toBe("engagement / pre-wedding function");
  });
});

describe("team columns", () => {
  it("summarises the sheet work for the lead's notes", () => {
    expect(describeTeamNotes({ owner: "Meera", remarks: "RNR", propertyShared: "Indiranagar" })).toBe(
      "Leads Sheet — Owner: Meera · Remarks: RNR · Property shared: Indiranagar"
    );
    expect(describeTeamNotes({})).toBeNull();
  });

  it("takes the first owner's first name; labels are not people (matched later)", () => {
    expect(ownerFirstName("Meera-Nayana")).toBe("meera");
    expect(ownerFirstName("Meera -Anshu")).toBe("meera");
    expect(ownerFirstName("nayana")).toBe("nayana");
    expect(ownerFirstName("High Intent")).toBe("high");
    expect(ownerFirstName(undefined)).toBeNull();
  });

  it("turns call remarks into a status only when they are clear", () => {
    expect(statusFromRemarks("not answered")).toBe("NOT_CONNECTED");
    expect(statusFromRemarks("RNR")).toBe("NOT_CONNECTED");
    expect(statusFromRemarks("Busy")).toBe("NOT_CONNECTED");
    expect(statusFromRemarks("Qualified, transfered to meera")).toBe("CONTACTED");
    expect(statusFromRemarks("call back")).toBe("CONTACTED");
    expect(statusFromRemarks("NOT ENQUIRED")).toBeNull();
    expect(statusFromRemarks("not interested")).toBeNull();
    expect(statusFromRemarks("")).toBeNull();
  });
});
