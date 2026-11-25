import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({ lead: { findUnique: vi.fn() }, user: { findMany: vi.fn() } }));
const m = vi.hoisted(() => ({ sendWhatsApp: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: m.sendWhatsApp }));
vi.mock("@/lib/notify", () => ({ notifyAwait: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/crm/lead-assigned-email", () => ({ sendLeadAssignedEmail: vi.fn() }));

import { sendNewLeadWhatsApp, parseWhatsAppRecipients, whatsappAlertSources, newLeadWhatsAppParams } from "./new-lead-whatsapp";

const lead = {
  id: "l1",
  title: "Wedding enquiry",
  source: "WEBSITE",
  eventType: "Wedding",
  eventDate: new Date("2027-02-14T00:00:00Z"),
  guestCount: 300,
  deletedAt: null,
  contact: { firstName: "Priya", lastName: "Sharma", phone: "+919800000000" },
};

describe("sendNewLeadWhatsApp", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEW_LEAD_ALERT_WHATSAPP_TEMPLATE = "new_lead_manager";
    process.env.NEW_LEAD_ALERT_WHATSAPP_TO = "nayana@x.in, 98450 12345";
    delete process.env.NEW_LEAD_ALERT_WHATSAPP_SOURCES;
    db.lead.findUnique.mockResolvedValue(lead);
    db.user.findMany.mockResolvedValue([{ phone: "9800000002" }]);
    m.sendWhatsApp.mockResolvedValue({ success: true });
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("sends a website lead to every manager with the template's five values", async () => {
    const res = await sendNewLeadWhatsApp("l1");
    expect(res).toEqual({ sent: 2, failed: 0 });
    const call = m.sendWhatsApp.mock.calls[0][0];
    expect(call.template).toBe("new_lead_manager");
    expect(call.language).toBe("en");
    expect(call.params["1"]).toBe("Website");
    expect(call.params["2"]).toBe("Priya Sharma");
    expect(call.params["3"]).toBe("Wedding, 14 Feb 2027, 300 guests");
    expect(call.params["4"]).toBe("+919800000000");
    expect(call.params["5"]).toMatch(/\/leads\/l1$/);
    // only active staff, by email
    expect(db.user.findMany.mock.calls[0][0].where.isActive).toBe(true);
  });

  it("Google Ads leads go too; other sources don't", async () => {
    db.lead.findUnique.mockResolvedValue({ ...lead, source: "GOOGLE_ADS" });
    expect((await sendNewLeadWhatsApp("l1")).sent).toBe(2);
    m.sendWhatsApp.mockClear();
    db.lead.findUnique.mockResolvedValue({ ...lead, source: "INSTAGRAM" });
    expect((await sendNewLeadWhatsApp("l1")).skipped).toBe("Source not alerted on WhatsApp");
    expect(m.sendWhatsApp).not.toHaveBeenCalled();
  });

  it("stays off until a template is configured", async () => {
    delete process.env.NEW_LEAD_ALERT_WHATSAPP_TEMPLATE;
    expect((await sendNewLeadWhatsApp("l1")).skipped).toBe("No template configured");
    expect(db.lead.findUnique).not.toHaveBeenCalled();
  });

  it("one failed number doesn't stop the others, and it never throws", async () => {
    m.sendWhatsApp.mockResolvedValueOnce({ success: false, error: "not opted in" });
    expect(await sendNewLeadWhatsApp("l1")).toEqual({ sent: 1, failed: 1 });
    db.lead.findUnique.mockRejectedValue(new Error("db down"));
    await expect(sendNewLeadWhatsApp("l1")).resolves.toMatchObject({ sent: 0 });
  });

  it("the same number listed twice gets one message", async () => {
    db.user.findMany.mockResolvedValue([{ phone: "9845012345" }]);
    expect((await sendNewLeadWhatsApp("l1")).sent).toBe(1);
  });
});

describe("parsing", () => {
  it("splits staff emails from phone numbers (which may contain spaces)", () => {
    expect(parseWhatsAppRecipients("A@x.in; 98450 12345, junk,+91 98450-12346")).toEqual({
      emails: ["a@x.in"],
      phones: ["98450 12345", "+91 98450-12346"],
    });
  });
  it("defaults to website and Google Ads", () => {
    expect([...whatsappAlertSources(undefined)]).toEqual(["WEBSITE", "GOOGLE_ADS"]);
    expect([...whatsappAlertSources("website, facebook_ads")]).toEqual(["WEBSITE", "FACEBOOK_ADS"]);
  });
  it("fills unknown event details honestly", () => {
    const p = newLeadWhatsAppParams({ leadId: "x", source: "WEBSITE", name: "", title: "Enquiry", phone: null, eventType: null, eventDate: null, guestCount: null });
    expect(p["2"]).toBe("Enquiry");
    expect(p["3"]).toBe("Not given");
    expect(p["4"]).toBe("Not given");
  });
});
