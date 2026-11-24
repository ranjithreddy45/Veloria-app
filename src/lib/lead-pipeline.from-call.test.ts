import { beforeEach, describe, expect, it, vi } from "vitest";

// runLeadIntake for a lead made from a phone call: customer-side steps run,
// staff alerts don't (src/lib/crm/call-lead.ts).

const m = vi.hoisted(() => ({
  triggerWorkflows: vi.fn(async () => {}),
  runSpeedToLead: vi.fn(async () => ({ ok: true, status: "SENT" })),
  enqueueNewLeadAlert: vi.fn(async () => {}),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { cadence: { findMany: vi.fn(async () => []) }, user: { findFirst: vi.fn(async () => ({ id: "admin" })) } },
}));
vi.mock("@/lib/notify", () => ({ notifyAwait: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/workflow-executor", () => ({ triggerWorkflows: m.triggerWorkflows }));
vi.mock("@/lib/cadence-exit-checker", () => ({ checkExitCriteria: vi.fn() }));
vi.mock("@/lib/lead-first-response", () => ({ runSpeedToLead: m.runSpeedToLead }));
vi.mock("@/lib/crm/new-lead-alert", () => ({ enqueueNewLeadAlert: m.enqueueNewLeadAlert }));

import { runLeadIntake } from "./lead-pipeline";

const lead = { id: "l1", contactId: "c1", source: "PHONE_INQUIRY", eventType: null, status: "NEW", guestCount: null, score: 0 };

beforeEach(() => vi.clearAllMocks());

describe("runLeadIntake", () => {
  it("a call lead: workflows run customer-side only, speed-to-lead is quiet, no group email", async () => {
    await runLeadIntake({ lead: lead as never, triggeredByUserId: "rep", fromCall: true });
    expect(m.triggerWorkflows).toHaveBeenCalledWith("LEAD_CREATED", expect.objectContaining({ skipStaffActions: true }));
    expect(m.runSpeedToLead).toHaveBeenCalledWith(expect.objectContaining({ quiet: true }));
    expect(m.enqueueNewLeadAlert).not.toHaveBeenCalled();
  });

  it("any other lead: full intake and the group email", async () => {
    await runLeadIntake({ lead: lead as never, triggeredByUserId: "rep" });
    const ctx = (m.triggerWorkflows.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(ctx.skipStaffActions).toBeUndefined();
    expect((m.runSpeedToLead.mock.calls[0] as unknown[])[0]).not.toHaveProperty("quiet");
    expect(m.enqueueNewLeadAlert).toHaveBeenCalledWith("l1");
  });
});
