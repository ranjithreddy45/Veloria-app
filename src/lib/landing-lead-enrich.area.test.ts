import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  lead: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  venue: { findFirst: vi.fn(), findUnique: vi.fn() },
  contact: { update: vi.fn() },
}));
const m = vi.hoisted(() => ({ rules: vi.fn(), owner: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/assignment/evaluate", () => ({ evaluateAssignmentRules: m.rules }));
vi.mock("@/lib/crm/default-lead-owner", () => ({ getDefaultLeadOwnerId: m.owner }));
vi.mock("@/lib/crm/lead-assigned-notify", () => ({ scheduleLeadsAssignedNotify: m.notify }));

import { enrichLandingLead } from "./landing-lead-enrich";

const base = {
  id: "l1", eventType: null, eventDate: null, guestCount: null, preferredVenueId: null, description: "Event: Wedding",
  area: null, areaSource: "none", assignedToId: "rajitha", lastTouchedAt: null, source: "WEBSITE", status: "NEW", score: 40,
  contactId: "c1", contact: { id: "c1", email: "x@y.in" },
};

describe("website step 2: area", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.lead.findFirst.mockResolvedValue({ ...base });
    db.venue.findFirst.mockResolvedValue({ id: "v1" });
    db.venue.findUnique.mockResolvedValue({ name: "Veloria Grand — Hosa Road · Grand Hall" });
    db.lead.updateMany.mockResolvedValue({ count: 1 });
    m.owner.mockResolvedValue("rajitha");
    m.rules.mockResolvedValue("nayana");
  });

  it("sets the area from the visitor's pick and hands an unworked lead to the area's rep", async () => {
    await enrichLandingLead("l1", { venueLocation: "Hosa Road (Singasandra)" });
    expect(db.lead.update.mock.calls[0][0].data).toMatchObject({ area: "HOSA_ROAD", areaSource: "given" });
    expect(m.rules).toHaveBeenCalledWith(expect.objectContaining({ area: "HOSA_ROAD" }), { onlyField: "area" });
    expect(db.lead.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "l1", assignedToId: "rajitha", lastTouchedAt: null },
      data: { assignedToId: "nayana" },
    });
    expect(m.notify).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: "nayana", isNew: true }));
  });

  it("leaves the owner alone once someone has worked the lead, or if it isn't with the default owner", async () => {
    db.lead.findFirst.mockResolvedValueOnce({ ...base, lastTouchedAt: new Date() });
    await enrichLandingLead("l1", { venueLocation: "Hosa Road" });
    db.lead.findFirst.mockResolvedValueOnce({ ...base, assignedToId: "meera" });
    await enrichLandingLead("l1", { venueLocation: "Hosa Road" });
    expect(db.lead.updateMany).not.toHaveBeenCalled();
  });

  it("never overrides an area a person set or cleared", async () => {
    db.lead.findFirst.mockResolvedValueOnce({ ...base, area: null, areaSource: "manual" });
    await enrichLandingLead("l1", { venueLocation: "Hosa Road" });
    expect(db.lead.update.mock.calls[0]?.[0].data.area).toBeUndefined();
    expect(m.rules).not.toHaveBeenCalled();
  });
});
