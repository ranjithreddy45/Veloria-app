import { describe, it, expect } from "vitest";
import { bdCandidatesForCity, cityOf, mapOwnerLead } from "./owner-lead";

const payload = (over: Record<string, unknown> = {}, answers: Record<string, string> = {}) => ({
  id: "1",
  created_time: "2026-10-03T09:15:00+0000",
  platform: "ig",
  campaign_name: "VG Owner Partnership - Leads Form - Bengaluru",
  field_data: Object.entries({
    "what_is_your_role_at_the_venue?": "Owner / co-owner",
    "what_type_of_venue_is_it?": "Lawn / open-air venue",
    "what_is_its_current_status?": "Operational",
    "what_support_are_you_considering?": "Full management (branding, marketing, sales, operations)",
    "when_would_you_consider_starting?": "Within 30 days",
    "which_venue_is_this,_and_in_which_part_of_bengaluru?": "Sri Lakshmi Gardens, Yelahanka",
    email: "owner@example.test",
    full_name: "Test Owner",
    phone: "+919000000002",
    ...answers,
  })
    .filter(([, v]) => v !== "")
    .map(([name, v]) => ({ name, values: [v] })),
  ...over,
});

describe("mapOwnerLead", () => {
  it("maps the form's words onto the BD lead and keeps every answer in the notes", () => {
    const m = mapOwnerLead(payload(), "VG Owner Partnership Application");
    expect(m).toMatchObject({
      ownerName: "Test Owner",
      phone: "+919000000002",
      email: "owner@example.test",
      propertyName: "Sri Lakshmi Gardens",
      locality: "Yelahanka",
      localityIsPlaceholder: false,
      city: "Bengaluru",
      propertyType: "LAWN",
      propertyStage: "OPERATIONAL",
      ownerType: "SOLE_OWNER",
      leadSource: "SOCIAL_MEDIA",
      isTest: false,
    });
    for (const s of ["Instagram", "Role at the venue: Owner / co-owner", "Venue type: Lawn / open-air venue", "Support wanted: Full management", "Would start: Within 30 days", "as written: Sri Lakshmi Gardens, Yelahanka"]) {
      expect(m.notes).toContain(s);
    }
  });

  it("maps roles, venue types and statuses; placeholders are named as such", () => {
    const r = (role: string) => mapOwnerLead(payload({}, { "what_is_your_role_at_the_venue?": role }));
    expect(r("Manager representing the owner")).toMatchObject({ ownerType: "MANAGER", leadSource: "SOCIAL_MEDIA" });
    expect(r("Authorised operator")).toMatchObject({ ownerType: "GPA_HOLDER" });
    expect(r("Broker")).toMatchObject({ ownerType: "MANAGER", leadSource: "BROKER" });
    expect(r("Other").ownerType).toBe("MANAGER");

    const t = (venue: string) => mapOwnerLead(payload({}, { "what_type_of_venue_is_it?": venue }));
    expect(t("Convention hall")).toMatchObject({ propertyType: "CONVENTION_CENTRE", propertyTypeIsPlaceholder: false });
    expect(t("Banquet hall").propertyType).toBe("BANQUET");
    expect(t("Other")).toMatchObject({ propertyType: "BANQUET", propertyTypeIsPlaceholder: true });
    expect(t("Other").notes).toContain("placeholder");

    const s = (status: string) => mapOwnerLead(payload({}, { "what_is_its_current_status?": status })).propertyStage;
    expect(s("Operational")).toBe("OPERATIONAL");
    expect(s("Opening soon")).toBeNull();
    expect(s("Planning stage")).toBe("GREENFIELD");

    const i = (support: string) => mapOwnerLead(payload({}, { "what_support_are_you_considering?": support })).qualOwnerInterested;
    expect(i("Full management (branding, marketing, sales, operations)")).toBe(true);
    expect(i("Marketing and sales only")).toBeNull();
    expect(i("Exploring options")).toBeNull();
  });

  it("takes the city from the question wording, then the form or campaign name", () => {
    expect(cityOf(payload())).toBe("Bengaluru");
    const guntur = payload(
      { campaign_name: "" },
      { "which_venue_is_this,_and_in_which_part_of_bengaluru?": "", "which_venue_is_this,_and_in_which_part_of_guntur?": "Royal Hall" },
    );
    expect(mapOwnerLead(guntur, "VG Owner Partnership Application - Guntur").city).toBe("Guntur");
    expect(cityOf({ campaign_name: "VG Owner Partnership - Leads Form - Vijayawada" })).toBe("Vijayawada");
  });

  it("reads the venue answer: name and area, a locality alone, a town, or nothing", () => {
    const v = (answer: string) => mapOwnerLead(payload({}, { "which_venue_is_this,_and_in_which_part_of_bengaluru?": answer }));
    expect(v("Sri Lakshmi Gardens, Yelahanka")).toMatchObject({ propertyName: "Sri Lakshmi Gardens", locality: "Yelahanka", city: "Bengaluru" });
    expect(v("jp nagar")).toMatchObject({ propertyName: "Venue not named", locality: "JP Nagar", city: "Bengaluru" });
    expect(v("it's in mysore")).toMatchObject({ propertyName: "Venue not named", locality: "Mysuru", city: "Mysuru" });
    const none = v("Call us");
    expect(none).toMatchObject({ propertyName: "Venue not named", locality: "Not given", city: "Bengaluru" });
    expect(none.notes).toContain("No venue name in the answer");
    expect(v("it's in mysore").notes).toContain("Filed under Mysuru from the answer");
  });

  it("flags Meta's test leads", () => {
    expect(mapOwnerLead(payload({}, { phone: "<test lead: dummy data for phone>" })).isTest).toBe(true);
  });

  it("routes by city per the owner's rule", () => {
    expect(bdCandidatesForCity("Bengaluru")).toEqual(["Nickson", "Rakshith"]);
    expect(bdCandidatesForCity("Guntur")).toEqual(["Srinivas"]);
    expect(bdCandidatesForCity("Vijayawada")).toEqual(["Srinivas"]);
    expect(bdCandidatesForCity("Somewhere")).toEqual(["Nickson", "Rakshith"]);
  });
});
