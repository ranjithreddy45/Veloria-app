import { describe, expect, it } from "vitest";
import { excelIst, groupByPhone, istDay, normalizePhone, planLead, STATUS_RULES, type SheetRow } from "./sheet-import";

// 24 Nov 2026, 19:30 IST — when the sheet was imported.
const NOW = new Date("2026-11-24T14:00:00.000Z");
const row = (over: Partial<SheetRow>): SheetRow => ({
  leadId: "BLR-X", name: "Someone", phone: "+919000000000", venue: null, owner: "Rakshith", status: "Connected - follow up",
  bucket: null, conversation: null, followUp: null, meetingDate: null, meetingTime: null, email: null, venueType: null, venueStage: null,
  ...over,
});

describe("dates and phones", () => {
  it("reads Excel serials as India time", () => {
    expect(istDay(excelIst(46304))).toBe("2026-10-09");
    // BLR-004's meeting: 9 Oct, 1:00 pm IST.
    expect(excelIst(46304, 0.5416666666666666).toISOString()).toBe("2026-10-09T07:30:00.000Z");
  });
  it("normalises the three odd phone formats in the sheet", () => {
    expect(normalizePhone("9380026314")).toBe("+919380026314");
    expect(normalizePhone("+91 7795572420")).toBe("+917795572420");
    expect(normalizePhone("+18197066725")).toBe("+18197066725");
  });
});

describe("planLead", () => {
  it("covers every status in the sheet", () => {
    for (const s of ["DNP / no answer", "Connected - follow up", "Not in city perimeter", "Junk / invalid / duplicate", "Meeting requested",
      "Not interested", "Prospect", "Meeting done", "Details shared - awaiting reply", "Proposal sent", "Won", "Wrong number",
      "Meeting scheduled", "Nurture - later"]) {
      expect(STATUS_RULES[s], s).toBeDefined();
    }
    expect(() => planLead([row({ status: "Something new" })], { now: NOW })).toThrow(/unknown status/);
    expect(() => planLead([row({ owner: "Ajith" })], { now: NOW })).toThrow(/unknown owner/);
  });

  it("a hot lead stays CONTACTED (so 'Qualify lead' still works), with its held meeting and a 🔥 note", () => {
    const p = planLead([row({ leadId: "BLR-004", status: "Meeting done", followUp: 46304, meetingDate: 46304, meetingTime: 0.5416666666666666,
      conversation: "Meeting held (3pm).", venue: "Siddhartha Convention Center, HSR Layout", venueType: "Convention hall", venueStage: "Operational" })], { now: NOW });
    expect(p).toMatchObject({ status: "CONTACTED", hot: true, reached: true, propertyType: "CONVENTION_CENTRE", propertyStage: "OPERATIONAL" });
    expect(p.meeting).toEqual({ scheduledAt: new Date("2026-10-09T07:30:00.000Z"), status: "COMPLETED" });
    // Follow-up 9 Oct had passed → tomorrow 10:00 IST.
    expect(p.nextFollowupAt?.toISOString()).toBe("2026-11-25T04:30:00.000Z");
    expect(p.note).toMatch(/^Imported from VG_Bangalore_Leads_Overview.xlsx \(BLR-004\)/);
    expect(p.note).toContain("🔥 Hot");
    expect(p.note).toContain("Meeting held: 9 Oct 2026");
    expect(p.note).toContain("moved to 2026-11-25");
  });

  it("a future meeting is scheduled; a future follow-up keeps its date", () => {
    const p = planLead([row({ status: "Meeting scheduled", followUp: 46353, meetingDate: 46353, meetingTime: 0.625 })], { now: NOW });
    expect(p.meeting).toEqual({ scheduledAt: new Date("2026-11-27T09:30:00.000Z"), status: "SCHEDULED" });
    expect(p.nextFollowupAt?.toISOString()).toBe("2026-11-27T04:30:00.000Z");
    expect(p.followUpMoved).toBe(false);
  });

  it("a past meeting the sheet doesn't confirm is noted, not recorded as held", () => {
    const p = planLead([row({ status: "Meeting requested", meetingDate: 46322, meetingTime: 0.4166666666666667, followUp: 46400 })], { now: NOW });
    expect(p.meeting).toBeNull();
    expect(p.note).toContain("whether it happened isn't recorded");
  });

  it("a follow-up dated today counts as passed", () => {
    const p = planLead([row({ status: "DNP / no answer", followUp: 46350 })], { now: NOW }); // 24 Nov
    expect(istDay(excelIst(46350))).toBe("2026-11-24");
    expect(p).toMatchObject({ status: "NEW", outcome: "NO_ANSWER", reached: false, followUpMoved: true });
  });

  it("closed leads are disqualified with a reason and no follow-up", () => {
    expect(planLead([row({ status: "Not in city perimeter", followUp: 46315 })], { now: NOW }))
      .toMatchObject({ status: "DISQUALIFIED", disqualifyReason: "OUT_OF_GEOGRAPHY", nextFollowupAt: null });
    expect(planLead([row({ status: "Wrong number", followUp: 46400 })], { now: NOW }))
      .toMatchObject({ status: "DISQUALIFIED", disqualifyReason: "OTHER", nextFollowupAt: null, reached: false });
  });

  it("a phone listed twice follows the row not marked duplicate and keeps the other in the note", () => {
    const rows = [
      row({ leadId: "BLR-026", name: "Bivan Choudhury", phone: "+919988423455", status: "Meeting requested", followUp: 46400 }),
      row({ leadId: "BLR-150", name: "Hussain", phone: "+919988423455", status: "Junk / invalid / duplicate", conversation: "dup" }),
    ];
    const groups = groupByPhone([row({ phone: "+911111111111" }), ...rows]);
    expect(groups).toHaveLength(2);
    const p = planLead(groups[1], { now: NOW });
    expect(p).toMatchObject({ leadId: "BLR-026", ownerName: "Bivan Choudhury", status: "CONTACTED", alsoListedAs: ["BLR-150"] });
    expect(p.note).toContain('Also listed in the sheet as BLR-150 (Hussain, "Junk / invalid / duplicate"): dup');
  });

  it("Nick is Nickson; 'Other' venue type and 'Opening soon' keep the CRM's values", () => {
    const p = planLead([row({ owner: "Nick", venueType: "Other", venueStage: "Opening soon" })], { now: NOW });
    expect(p).toMatchObject({ owner: "NICK", propertyType: null, propertyStage: null });
  });
});
