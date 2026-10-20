import { describe, it, expect, vi, beforeEach } from "vitest";

// The past-enquiry mode of captureLeadFromExternal (a Meta lead-ads import):
// real dates, no SLA clock, no customer/rep-facing side effects, and matching
// the same enquiry already brought in by the Google Sheet sync.

const db = vi.hoisted(() => {
  const lead = { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() };
  return {
    lead,
    contact: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    autoWelcomeConfig: { findUnique: vi.fn() },
    task: { create: vi.fn() },
    user: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({ $queryRaw: vi.fn(), lead: { findFirst: vi.fn(async () => null), create: lead.create } }),
    ),
  };
});
const side = vi.hoisted(() => ({
  notify: vi.fn(),
  email: vi.fn(async () => ({ sent: true })),
  intake: vi.fn(async () => {}),
  welcome: vi.fn(async () => ({ success: true })),
}));

vi.mock("next/server", () => ({ after: (fn: () => void) => fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/notify", () => ({ notify: side.notify }));
vi.mock("@/lib/crm/lead-assigned-email", () => ({ sendLeadAssignedEmail: side.email }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/lead-scoring", () => ({ calculateLeadScore: () => 10 }));
vi.mock("@/lib/assignment/evaluate", () => ({ evaluateAssignmentRules: vi.fn(async () => "rep-1") }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: side.welcome }));
vi.mock("@/lib/lead-pipeline", () => ({ runLeadIntake: side.intake, leadSlaDeadline: () => new Date("2099-01-01T00:00:00Z") }));
vi.mock("@/lib/attribution", () => ({ attachAttributionToLead: vi.fn() }));
vi.mock("@/lib/integrations/lead-sync", () => ({ syncLeadToWhatsAppProvider: vi.fn(async () => {}) }));
vi.mock("@/lib/integrations/callvibe/push", () => ({ scheduleAutoPushToCallVibe: vi.fn() }));
vi.mock("@/lib/privacy/consent", () => ({ recordConsent: vi.fn() }));

import { captureLeadFromExternal } from "./lead-capture";

const OCT3 = new Date("2026-10-03T09:15:00Z");
const base = {
  name: "Asha Rao",
  phone: "+919006612345",
  source: "facebook_ads",
  eventType: "Wedding",
  externalId: "fb:L1",
};

describe("captureLeadFromExternal — past enquiry (historical)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.lead.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([]);
    db.contact.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "c1", enquirySource: "FACEBOOK", ...data }));
    db.lead.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "lead-1", status: "NEW", ...data }));
    db.lead.update.mockResolvedValue({});
    db.autoWelcomeConfig.findUnique.mockResolvedValue({ isEnabled: true, delayMinutes: 0, templateName: "welcome" });
    db.user.findFirst.mockResolvedValue({ id: "admin" });
  });

  it("dates the lead and contact at the enquiry, starts no SLA clock and fires nothing", async () => {
    const res = await captureLeadFromExternal({ ...base, historical: { receivedAt: OCT3 } });
    expect(res).toMatchObject({ success: true, leadId: "lead-1" });
    const lead = db.lead.create.mock.calls[0][0].data;
    expect(lead.createdAt).toEqual(OCT3);
    expect(lead.firstContactDue).toBeNull();
    expect(lead.assignedToId).toBe("rep-1"); // still gets an owner
    expect(lead.salesTeam).toBe("WEDDING"); // and its team
    expect(db.contact.create.mock.calls[0][0].data.createdAt).toEqual(OCT3);
    expect(side.notify).not.toHaveBeenCalled();
    expect(side.email).not.toHaveBeenCalled();
    expect(side.intake).not.toHaveBeenCalled();
    expect(side.welcome).not.toHaveBeenCalled();
  });

  it("a live lead keeps the normal behaviour, dated at occurredAt", async () => {
    const at = new Date(Date.now() - 60_000);
    await captureLeadFromExternal({ ...base, occurredAt: at });
    const lead = db.lead.create.mock.calls[0][0].data;
    expect(lead.createdAt).toEqual(at);
    expect(lead.firstContactDue).toEqual(new Date("2099-01-01T00:00:00Z"));
    expect(side.notify).toHaveBeenCalled();
    expect(side.intake).toHaveBeenCalled();
  });

  it("ignores a future occurredAt", async () => {
    await captureLeadFromExternal({ ...base, occurredAt: new Date(Date.now() + 86_400_000) });
    expect(db.lead.create.mock.calls[0][0].data.createdAt).toBeUndefined();
  });

  it("fills the Sheet-synced copy of the same enquiry instead of duplicating it — even if it was closed", async () => {
    db.contact.findMany.mockResolvedValue([{ id: "c1", phone: "+919006612345", email: null, enquirySource: "FACEBOOK" }]);
    db.lead.findFirst
      .mockResolvedValueOnce(null) // externalId check
      .mockResolvedValueOnce({
        id: "sheet-lead",
        status: "LOST",
        description: "Facebook lead (sheet)",
        eventType: null,
        eventDate: null,
        guestCount: null,
        preferredVenueId: null,
        salesTeam: null,
        salesTeamManual: false,
      });
    const res = await captureLeadFromExternal({ ...base, guestCount: 300, historical: { receivedAt: OCT3 } });
    expect(res).toMatchObject({ leadId: "sheet-lead", deduped: true });
    expect(db.lead.create).not.toHaveBeenCalled();
    // The match window reaches closed leads from the same few days.
    const where = db.lead.findFirst.mock.calls[1][0].where;
    expect(where.OR).toHaveLength(2);
    const upd = db.lead.update.mock.calls[0][0].data;
    expect(upd).toMatchObject({ eventType: "Wedding", guestCount: 300, salesTeam: "WEDDING" });
    expect(upd.description).toContain("enquiry of 2026-10-03");
  });

  it("files an Instagram lead ad as INSTAGRAM, not OTHER", async () => {
    await captureLeadFromExternal({ ...base, source: "instagram", historical: { receivedAt: OCT3 } });
    expect(db.lead.create.mock.calls[0][0].data.source).toBe("INSTAGRAM");
  });
});
