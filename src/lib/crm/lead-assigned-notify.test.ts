import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  lead: { findMany: vi.fn() },
}));
const m = vi.hoisted(() => ({
  notifyAwait: vi.fn(),
  sendEmail: vi.fn(),
  sendWhatsApp: vi.fn(),
  sendLeadAssignedEmail: vi.fn(),
  shouldSend: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/notify", () => ({ notifyAwait: m.notifyAwait }));
vi.mock("@/lib/email", () => ({ sendEmail: m.sendEmail }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: m.sendWhatsApp }));
vi.mock("@/lib/crm/lead-assigned-email", () => ({ sendLeadAssignedEmail: m.sendLeadAssignedEmail }));

import { notifyLeadsAssigned, waParam, leadSummary } from "./lead-assigned-notify";

const rep = { id: "rep", name: "Asha Rao", email: "asha@x.in", phone: "9800000001", isActive: true, role: "SALES_EXEC" };
const head = { name: "Sunitha" };
const leadRow = (id: string, first = "Priya") => ({
  id,
  title: `Lead ${id}`,
  source: "GOOGLE_ADS",
  eventType: "Wedding",
  eventDate: new Date("2027-02-14T00:00:00Z"),
  guestCount: 250,
  contact: { firstName: first, lastName: "Sharma", phone: "+919800000000" },
});

describe("notifyLeadsAssigned", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEAD_ASSIGNED_WHATSAPP_TEMPLATE = "lead_assigned_staff";
    db.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "rep" ? rep : where.id === "head" ? head : null
    );
    db.lead.findMany.mockResolvedValue([leadRow("l1")]);
    m.notifyAwait.mockResolvedValue(undefined);
    m.sendEmail.mockResolvedValue({ success: true });
    m.sendWhatsApp.mockResolvedValue({ success: true });
    m.sendLeadAssignedEmail.mockResolvedValue({ sent: true });
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("tells the new owner on all three channels for one lead", async () => {
    const res = await notifyLeadsAssigned({ leadIds: ["l1"], assigneeId: "rep", assignedById: "head" });
    expect(res).toMatchObject({ inApp: true, email: { sent: true }, whatsapp: { sent: true } });

    const bell = m.notifyAwait.mock.calls[0][0];
    expect(bell).toMatchObject({ userId: "rep", type: "LEAD_ASSIGNED", actionUrl: "/leads/l1" });
    expect(bell.title).toBe("Lead assigned to you: Priya Sharma");
    // no customer phone on a lock-screen push
    expect(bell.message).not.toContain("+919800000000");
    expect(bell.message).toContain("assigned by Sunitha");

    expect(m.sendLeadAssignedEmail).toHaveBeenCalledWith("l1", "rep", { assignedByName: "Sunitha", isNew: false });

    const wa = m.sendWhatsApp.mock.calls[0][0];
    expect(wa.to).toBe("+919800000001");
    expect(wa.template).toBe("lead_assigned_staff");
    expect(Object.values(wa.params)).toEqual([
      "Asha",
      "a lead",
      "Sunitha",
      expect.stringContaining("Priya Sharma · +919800000000 · Wedding on"),
      "https://app.theveloriagrand.com/leads/l1",
    ]);
  });

  it("a brand-new lead is called new; a reassigned one is not", async () => {
    await notifyLeadsAssigned({ leadIds: ["l1"], assigneeId: "rep", assignedById: null, isNew: true });
    expect(m.notifyAwait.mock.calls[0][0].title).toBe("New lead assigned to you: Priya Sharma");
    expect(m.sendLeadAssignedEmail).toHaveBeenCalledWith("l1", "rep", { assignedByName: null, isNew: true });
    expect(Object.values(m.sendWhatsApp.mock.calls[0][0].params)[1]).toBe("a new lead");
  });

  it("sends nothing when you assign a lead to yourself", async () => {
    const res = await notifyLeadsAssigned({ leadIds: ["l1"], assigneeId: "rep", assignedById: "rep" });
    expect(res.skipped).toBe("Assigned to self");
    expect(m.notifyAwait).not.toHaveBeenCalled();
  });

  it("skips a deactivated or venue-owner assignee", async () => {
    db.user.findUnique.mockResolvedValueOnce({ ...rep, isActive: false }).mockResolvedValueOnce(head);
    expect((await notifyLeadsAssigned({ leadIds: ["l1"], assigneeId: "rep", assignedById: "head" })).skipped).toBe(
      "Assignee is deactivated"
    );
    db.user.findUnique.mockResolvedValueOnce({ ...rep, role: "VENUE_OWNER" }).mockResolvedValueOnce(head);
    expect((await notifyLeadsAssigned({ leadIds: ["l1"], assigneeId: "rep", assignedById: "head" })).skipped).toMatch(
      /Venue owners/
    );
  });

  it("a bulk assignment is ONE notice per channel, not one per lead", async () => {
    db.lead.findMany.mockResolvedValue([leadRow("l1", "A"), leadRow("l2", "B"), leadRow("l3", "C"), leadRow("l4", "D")]);
    await notifyLeadsAssigned({ leadIds: ["l1", "l2", "l3", "l4"], assigneeId: "rep", assignedById: "head" });
    expect(m.notifyAwait).toHaveBeenCalledTimes(1);
    expect(m.notifyAwait.mock.calls[0][0].title).toBe("4 leads assigned to you");
    expect(m.sendLeadAssignedEmail).not.toHaveBeenCalled();
    expect(m.sendEmail).toHaveBeenCalledTimes(1);
    expect(m.sendEmail.mock.calls[0][0].subject).toBe("4 leads assigned to you by Sunitha");
    expect(m.sendWhatsApp).toHaveBeenCalledTimes(1);
    const p = Object.values(m.sendWhatsApp.mock.calls[0][0].params) as string[];
    expect(p[1]).toBe("4 leads");
    expect(p[3]).toContain("and 1 more");
    expect(p[4]).toBe("https://app.theveloriagrand.com/leads");
  });

  it("automatic routing says so, and WhatsApp waits for a template", async () => {
    delete process.env.LEAD_ASSIGNED_WHATSAPP_TEMPLATE;
    const res = await notifyLeadsAssigned({ leadIds: ["l1"], assigneeId: "rep", assignedById: null });
    expect(m.notifyAwait.mock.calls[0][0].message).toContain("the CRM (automatic)");
    expect(res.whatsapp).toEqual({ sent: false, reason: "No WhatsApp template configured" });
    expect(m.sendWhatsApp).not.toHaveBeenCalled();
  });

  it("respects the person's own 'Lead assigned' email setting", async () => {
    db.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "rep"
        ? { ...rep, notificationPreferences: [{ key: "lead_assigned", emailEnabled: false, smsEnabled: false }] }
        : head
    );
    const res = await notifyLeadsAssigned({ leadIds: ["l1"], assigneeId: "rep", assignedById: "head" });
    expect(res.email).toEqual({ sent: false, reason: "Turned off in notification settings" });
    expect(m.sendLeadAssignedEmail).not.toHaveBeenCalled();
    expect(m.notifyAwait).toHaveBeenCalledTimes(1);
    expect(res.whatsapp).toEqual({ sent: true });
  });

  it("the catch-all owner can be limited to the in-app notice", async () => {
    const res = await notifyLeadsAssigned({
      leadIds: ["l1"],
      assigneeId: "rep",
      assignedById: null,
      channels: { email: false, whatsapp: false },
    });
    expect(m.notifyAwait).toHaveBeenCalledTimes(1);
    expect(m.sendLeadAssignedEmail).not.toHaveBeenCalled();
    expect(m.sendWhatsApp).not.toHaveBeenCalled();
    expect(res.email?.sent).toBe(false);
  });

  it("a new phone lead rings the bell only: no email, no WhatsApp", async () => {
    db.lead.findMany.mockResolvedValue([{ ...leadRow("l1"), source: "PHONE_INQUIRY" }]);
    const res = await notifyLeadsAssigned({ leadIds: ["l1"], assigneeId: "rep", isNew: true });
    expect(res.inApp).toBe(true);
    expect(res.email).toEqual({ sent: false, reason: "Phone lead: already spoken to" });
    expect(res.whatsapp).toEqual({ sent: false, reason: "Phone lead: already spoken to" });
    expect(m.sendLeadAssignedEmail).not.toHaveBeenCalled();
    expect(m.sendWhatsApp).not.toHaveBeenCalled();
  });

  it("a phone lead handed to someone later still reaches them everywhere", async () => {
    db.lead.findMany.mockResolvedValue([{ ...leadRow("l1"), source: "PHONE_INQUIRY" }]);
    const res = await notifyLeadsAssigned({ leadIds: ["l1"], assigneeId: "rep", assignedById: "head" });
    expect(res).toMatchObject({ email: { sent: true }, whatsapp: { sent: true } });
  });

  it("one channel failing never stops the others", async () => {
    m.sendLeadAssignedEmail.mockRejectedValue(new Error("SMTP down"));
    m.notifyAwait.mockRejectedValue(new Error("db"));
    const res = await notifyLeadsAssigned({ leadIds: ["l1"], assigneeId: "rep", assignedById: "head" });
    expect(res.email).toEqual({ sent: false, reason: "SMTP down" });
    expect(res.inApp).toBe(false);
    expect(res.whatsapp).toEqual({ sent: true });
  });
});

describe("WhatsApp-safe text", () => {
  it("flattens newlines, tabs and runs of spaces, and caps length", () => {
    expect(waParam("a\nb\t c     d")).toBe("a b c d");
    expect(waParam("", 10)).toBe("-");
    expect(waParam("x".repeat(50), 10)).toBe("x".repeat(9) + "…");
  });

  it("summarises a lead on one line", () => {
    expect(
      leadSummary({ id: "l", title: "T", source: "WEBSITE", eventType: null, eventDate: null, guestCount: null, name: "", phone: null })
    ).toBe("T");
  });
});

describe("leadAssignedEmailEnabled", () => {
  it("is on unless the person saved it off", async () => {
    const { leadAssignedEmailEnabled } = await import("./lead-assigned-notify");
    expect(leadAssignedEmailEnabled(null)).toBe(true);
    expect(leadAssignedEmailEnabled([{ key: "booking_confirmed", emailEnabled: false }])).toBe(true);
    expect(leadAssignedEmailEnabled([{ key: "lead_assigned", emailEnabled: true }])).toBe(true);
    expect(leadAssignedEmailEnabled([{ key: "lead_assigned", emailEnabled: false }])).toBe(false);
  });
});
