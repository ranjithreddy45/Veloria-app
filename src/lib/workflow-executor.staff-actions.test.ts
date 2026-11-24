import { beforeEach, describe, expect, it, vi } from "vitest";

// skipStaffActions: a lead made from a call a rep already handled runs only the
// customer-facing workflow actions (no "call within 15 minutes" task).

const db = vi.hoisted(() => ({
  workflow: { findUnique: vi.fn() },
  workflowLog: { create: vi.fn(async () => ({})) },
  lead: { findUnique: vi.fn() },
  task: { create: vi.fn(async () => ({ id: "t1" })) },
  user: { findFirst: vi.fn(async () => ({ id: "admin" })) },
  emailTemplate: { findFirst: vi.fn(async () => null), findUnique: vi.fn(async () => null) },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/email-tracking", () => ({ processEmailForTracking: vi.fn((html: string) => html) }));
vi.mock("@/lib/crm/lead-status", () => ({ guardLeadStatusChange: vi.fn() }));

import { runWorkflowActions } from "./workflow-executor";

beforeEach(() => {
  vi.clearAllMocks();
  db.workflow.findUnique.mockResolvedValue({
    id: "wf",
    name: "Inquiry Acknowledgement",
    isActive: true,
    actions: [
      { type: "SEND_EMAIL", config: { template: "ack", to: "contact" } },
      { type: "CREATE_TASK", config: { title: "Call new inquiry within 15 minutes" } },
      { type: "SEND_NOTIFICATION", config: { message: "New lead" } },
    ],
  });
  db.lead.findUnique.mockResolvedValue({ title: "L", contact: { id: "c1", firstName: "A", lastName: "B", email: null, phone: null } });
});

describe("workflow staff actions", () => {
  it("are skipped for a call lead; the customer action still runs", async () => {
    const res = await runWorkflowActions("wf", { leadId: "l-call", triggeredByUserId: "rep", skipStaffActions: true });
    expect(db.task.create).not.toHaveBeenCalled();
    const logged = db.workflowLog.create.mock.calls.map((c) => (c as unknown as [{ data: { action: string } }])[0].data.action);
    expect(logged).toEqual(["SEND_EMAIL"]);
    expect(res.executed).toBe(1);
  });

  it("run as before for any other lead", async () => {
    await runWorkflowActions("wf", { leadId: "l-web", triggeredByUserId: "rep" });
    expect(db.task.create).toHaveBeenCalledTimes(1);
    const logged = db.workflowLog.create.mock.calls.map((c) => (c as unknown as [{ data: { action: string } }])[0].data.action);
    expect(logged).toEqual(["SEND_EMAIL", "CREATE_TASK", "SEND_NOTIFICATION"]);
  });
});
