import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => {
  const tx = {
    lead: { updateMany: vi.fn() },
    task: { updateMany: vi.fn() },
    deal: { updateMany: vi.fn() },
  };
  return {
    tx,
    lead: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
});
const m = vi.hoisted(() => ({ notify: vi.fn(), log: vi.fn(), pick: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: m.log }));
vi.mock("@/lib/crm/lead-assigned-notify", () => ({ scheduleLeadsAssignedNotify: m.notify }));
vi.mock("@/lib/crm/sales-team-db", () => ({ pickTeamAssignee: m.pick }));

import { reassignStrandedLeads, strandedLeadOwners, destinationError } from "./stranded-leads";

const leads = [
  { id: "l1", salesTeam: "WEDDING", assignedToId: "gone" },
  { id: "l2", salesTeam: "CORPORATE", assignedToId: "gone" },
  { id: "l3", salesTeam: null, assignedToId: "gone" },
];

describe("reassignStrandedLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findMany.mockResolvedValue([{ id: "gone" }]); // really deactivated
    db.lead.findMany.mockImplementation(async ({ where }: { where: { id?: { in: string[] } } }) =>
      where.id ? leads.filter((l) => where.id!.in.includes(l.id)) : leads
    );
    db.tx.lead.updateMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => ({
      count: where.id.in.length,
    }));
    m.log.mockResolvedValue(undefined);
  });

  it("moves every open lead to one person, with their tasks and deals, and notifies once", async () => {
    const res = await reassignStrandedLeads({ fromUserIds: ["gone"], mode: "person", toUserId: "asha", actorId: "head" });
    expect(res).toEqual({ moved: 3, byAssignee: [{ userId: "asha", count: 3 }], skipped: 0 });

    const leadWhere = db.tx.lead.updateMany.mock.calls[0][0];
    expect(leadWhere.where.assignedToId).toEqual({ in: ["gone"] }); // guarded
    expect(leadWhere.data).toEqual({ assignedToId: "asha" });
    expect(db.tx.task.updateMany.mock.calls[0][0]).toMatchObject({
      where: { assigneeId: { in: ["gone"] }, status: { not: "DONE" } },
      data: { assigneeId: "asha" },
    });
    expect(db.tx.deal.updateMany.mock.calls[0][0].data).toEqual({ assignedToId: "asha" });

    expect(m.notify).toHaveBeenCalledTimes(1);
    expect(m.notify.mock.calls[0][0]).toEqual({ leadIds: ["l1", "l2", "l3"], assigneeId: "asha", assignedById: "head" });
    expect(m.log).toHaveBeenCalledTimes(3);
    expect(m.log.mock.calls[0][0]).toMatchObject({ action: "REASSIGN_FROM_INACTIVE", changes: { assignedToId: { from: "gone", to: "asha" } } });
  });

  it("team mode shares by team and sends team-less leads to the fallback person", async () => {
    m.pick.mockImplementation(async (team: string | null) => (team === "WEDDING" ? "wedRep" : team === "CORPORATE" ? "corpRep" : null));
    const res = await reassignStrandedLeads({ fromUserIds: ["gone"], mode: "team", toUserId: "head", actorId: "head" });
    expect(res.moved).toBe(3);
    expect(res.byAssignee).toEqual([
      { userId: "wedRep", count: 1 },
      { userId: "corpRep", count: 1 },
      { userId: "head", count: 1 },
    ]);
    expect(m.notify).toHaveBeenCalledTimes(3);
  });

  it("never takes leads off someone who is still active", async () => {
    db.user.findMany.mockResolvedValue([]); // the 'from' user is active
    const res = await reassignStrandedLeads({ fromUserIds: ["active"], mode: "person", toUserId: "asha", actorId: "head" });
    expect(res.moved).toBe(0);
    expect(db.lead.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("leaves a lead someone picked up meanwhile", async () => {
    // between planning and moving, l2 was given to someone by hand
    let call = 0;
    db.lead.findMany.mockImplementation(async ({ where }: { where: { id?: { in: string[] } } }) => {
      call++;
      return call === 1 ? leads : leads.filter((l) => l.id !== "l2" && where.id!.in.includes(l.id));
    });
    const res = await reassignStrandedLeads({ fromUserIds: ["gone"], mode: "person", toUserId: "asha", actorId: "head" });
    expect(res).toMatchObject({ moved: 2, skipped: 1 });
    expect(m.notify.mock.calls[0][0].leadIds).toEqual(["l1", "l3"]);
  });
});

describe("strandedLeadOwners", () => {
  it("lists deactivated owners with open leads, most first", async () => {
    db.lead.groupBy.mockResolvedValue([
      { assignedToId: "a", _count: { _all: 4 } },
      { assignedToId: "b", _count: { _all: 120 } },
    ]);
    db.user.findMany.mockResolvedValue([
      { id: "a", name: "Ravi", email: "r@x", role: "SALES_EXEC" },
      { id: "b", name: "Meera", email: "m@x", role: "SALES_EXEC" },
    ]);
    const owners = await strandedLeadOwners();
    expect(owners.map((o) => [o.name, o.openLeads])).toEqual([["Meera", 120], ["Ravi", 4]]);
    expect(db.lead.groupBy.mock.calls[0][0].where).toMatchObject({
      deletedAt: null,
      status: { notIn: ["WON", "LOST"] },
      assignedTo: { isActive: false },
    });
  });
});

describe("destinationError", () => {
  it("accepts only an active, assignable person", async () => {
    db.user.findUnique.mockResolvedValueOnce({ isActive: true, role: "SALES_EXEC" });
    expect(await destinationError("x")).toBeNull();
    db.user.findUnique.mockResolvedValueOnce({ isActive: false, role: "SALES_EXEC" });
    expect(await destinationError("x")).not.toBeNull();
    db.user.findUnique.mockResolvedValueOnce({ isActive: true, role: "FINANCE" });
    expect(await destinationError("x")).not.toBeNull();
  });
});
