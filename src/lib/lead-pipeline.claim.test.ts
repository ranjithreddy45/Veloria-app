import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  lead: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  user: { findMany: vi.fn() },
}));
const notifyAwait = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/notify", () => ({ notifyAwait }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/workflow-executor", () => ({ triggerWorkflows: vi.fn() }));
vi.mock("@/lib/cadence-exit-checker", () => ({ checkExitCriteria: vi.fn() }));

import { escalateLeadSlaBreaches } from "./lead-pipeline";

beforeEach(() => {
  vi.clearAllMocks();
  db.lead.findMany.mockResolvedValue([{ id: "l1", title: "x", assignedToId: "rep", contact: { firstName: "A", lastName: "B" } }]);
  db.user.findMany.mockResolvedValue([{ id: "admin" }]);
});

describe("lead SLA escalation claims before alerting (R1-1)", () => {
  it("alerts when this run wins the claim", async () => {
    db.lead.updateMany.mockResolvedValue({ count: 1 });
    expect(await escalateLeadSlaBreaches()).toBe(1);
    expect(notifyAwait).toHaveBeenCalledTimes(2);
    expect(db.lead.updateMany.mock.invocationCallOrder[0]).toBeLessThan(notifyAwait.mock.invocationCallOrder[0]);
  });
  it("sends nothing when an overlapping run already claimed it", async () => {
    db.lead.updateMany.mockResolvedValue({ count: 0 });
    expect(await escalateLeadSlaBreaches()).toBe(0);
    expect(notifyAwait).not.toHaveBeenCalled();
  });
});
