import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  salesTeam: { createMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  user: { findMany: vi.fn() },
  repAvailability: { findMany: vi.fn() },
  lead: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { pickTeamAssignee, sortUnsortedLeads } from "./sales-team-db";

const MEMBERS = [
  { id: "a", name: "Asha" },
  { id: "b", name: "Bala" },
  { id: "c", name: "Chitra" },
];

describe("pickTeamAssignee — round-robin inside one team", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.salesTeam.createMany.mockResolvedValue({ count: 0 });
    db.user.findMany.mockResolvedValue(MEMBERS);
    db.repAvailability.findMany.mockResolvedValue([]);
    db.salesTeam.updateMany.mockResolvedValue({ count: 1 });
  });

  it("gives the next rep in turn and advances the pointer with a guarded update", async () => {
    db.salesTeam.findUnique.mockResolvedValue({ autoRoute: true, lastAssignedIdx: 0 });
    expect(await pickTeamAssignee("WEDDING")).toBe("b");
    expect(db.salesTeam.updateMany).toHaveBeenCalledWith({
      where: { key: "WEDDING", lastAssignedIdx: 0 },
      data: { lastAssignedIdx: 1 },
    });
  });

  it("wraps around, and starts at the first rep on a fresh team", async () => {
    db.salesTeam.findUnique.mockResolvedValue({ autoRoute: true, lastAssignedIdx: 2 });
    expect(await pickTeamAssignee("WEDDING")).toBe("a");
    db.salesTeam.findUnique.mockResolvedValue({ autoRoute: true, lastAssignedIdx: -1 });
    expect(await pickTeamAssignee("WEDDING")).toBe("a");
  });

  it("skips a rep who marked themselves AWAY, but not one merely OFFLINE (the default)", async () => {
    db.salesTeam.findUnique.mockResolvedValue({ autoRoute: true, lastAssignedIdx: 0 });
    db.repAvailability.findMany.mockResolvedValue([
      { userId: "b", status: "AWAY" },
      { userId: "c", status: "OFFLINE" },
    ]);
    expect(await pickTeamAssignee("WEDDING")).toBe("c");
  });

  it("still gives the lead an owner when the whole team is away", async () => {
    db.salesTeam.findUnique.mockResolvedValue({ autoRoute: true, lastAssignedIdx: 0 });
    db.repAvailability.findMany.mockResolvedValue(MEMBERS.map((m) => ({ userId: m.id, status: "AWAY" })));
    expect(await pickTeamAssignee("WEDDING")).toBe("b");
  });

  it("retries when another lead won the race for the pointer", async () => {
    db.salesTeam.findUnique
      .mockResolvedValueOnce({ autoRoute: true, lastAssignedIdx: 0 })
      .mockResolvedValueOnce({ autoRoute: true, lastAssignedIdx: 1 });
    db.salesTeam.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    expect(await pickTeamAssignee("WEDDING")).toBe("c");
  });

  it("returns null (fall back to the general rules) when routing is off, the team is empty, or the team is unknown", async () => {
    db.salesTeam.findUnique.mockResolvedValue({ autoRoute: false, lastAssignedIdx: 0 });
    expect(await pickTeamAssignee("WEDDING")).toBeNull();
    db.salesTeam.findUnique.mockResolvedValue({ autoRoute: true, lastAssignedIdx: 0 });
    db.user.findMany.mockResolvedValue([]);
    expect(await pickTeamAssignee("WEDDING")).toBeNull();
    expect(await pickTeamAssignee("MARKETING")).toBeNull();
    expect(await pickTeamAssignee(null)).toBeNull();
  });
});

describe("sortUnsortedLeads — the hourly backstop", () => {
  beforeEach(() => vi.resetAllMocks());

  it("sorts by event type, never touches hand-sorted leads, and leaves the rest Unsorted", async () => {
    db.lead.findMany.mockResolvedValue([
      { id: "1", eventType: "Wedding" },
      { id: "2", eventType: "Corporate event" },
      { id: "3", eventType: "Other" },
    ]);
    db.lead.updateMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => ({ count: where.id.in.length }));
    db.lead.count.mockResolvedValue(1);
    expect(await sortUnsortedLeads()).toEqual({ sorted: 2, stillUnsorted: 1 });
    expect(db.lead.findMany.mock.calls[0][0].where).toMatchObject({ salesTeam: null, salesTeamManual: false });
    for (const call of db.lead.updateMany.mock.calls) {
      expect(call[0].where).toMatchObject({ salesTeam: null, salesTeamManual: false });
    }
  });
});
