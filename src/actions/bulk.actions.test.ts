import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  lead: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
}));
const notifyMock = vi.hoisted(() => vi.fn());

vi.mock("@/../auth", () => ({ auth: vi.fn(async () => ({ user: { id: "head", role: "SALES_HEAD" } })) }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/crm/lead-status", () => ({ guardLeadStatusChangeMany: vi.fn() }));
vi.mock("@/lib/crm/lead-assigned-notify", () => ({ scheduleLeadsAssignedNotify: notifyMock }));

import { bulkAssignLeads, bulkUpdateLeads } from "./bulk.actions";

describe("bulk assignment notifies the new owner once, for leads that changed hands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue({ id: "rep", role: "SALES_EXEC", isActive: true });
    db.lead.updateMany.mockResolvedValue({ count: 3 });
  });

  it("bulkAssignLeads: one batched notice, only for leads the rep did not already own", async () => {
    db.lead.findMany.mockResolvedValue([{ id: "l1" }, { id: "l3" }]);
    const res = await bulkAssignLeads({ ids: ["l1", "l2", "l3"], assignedToId: "rep" });
    expect(res.success).toBe(true);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith({ leadIds: ["l1", "l3"], assigneeId: "rep", assignedById: "head" });
  });

  it("bulkAssignLeads: nothing to say when the rep already owned them all", async () => {
    db.lead.findMany.mockResolvedValue([]);
    await bulkAssignLeads({ ids: ["l1"], assignedToId: "rep" });
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("bulkUpdateLeads with an owner notifies; without one it does not", async () => {
    db.lead.findMany.mockResolvedValue([{ id: "l2" }]);
    await bulkUpdateLeads({ ids: ["l1", "l2"], data: { assignedToId: "rep" } });
    expect(notifyMock).toHaveBeenCalledWith({ leadIds: ["l2"], assigneeId: "rep", assignedById: "head" });
    notifyMock.mockClear();
    await bulkUpdateLeads({ ids: ["l1"], data: { source: "WEBSITE" } } as never);
    expect(notifyMock).not.toHaveBeenCalled();
  });
});
