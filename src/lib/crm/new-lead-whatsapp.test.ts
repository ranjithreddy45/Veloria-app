import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  lead: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  cronLaneLease: { createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
}));
const m = vi.hoisted(() => ({ sendWhatsApp: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: m.report }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: m.sendWhatsApp }));
vi.mock("@/lib/notify", () => ({ notifyAwait: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/crm/lead-assigned-email", () => ({ sendLeadAssignedEmail: vi.fn() }));

import {
  sendNewLeadWhatsApp,
  retryDueNewLeadWhatsApps,
  parseWhatsAppRecipients,
  whatsappAlertSources,
  newLeadWhatsAppParams,
} from "./new-lead-whatsapp";

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
    db.cronLaneLease.createMany.mockResolvedValue({ count: 1 });
    db.cronLaneLease.update.mockResolvedValue({});
    db.cronLaneLease.updateMany.mockResolvedValue({ count: 1 });
    db.cronLaneLease.findMany.mockResolvedValue([]);
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

  it("each manager gets one message per lead, even if two workers race", async () => {
    db.cronLaneLease.createMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await sendNewLeadWhatsApp("l1")).toEqual({ sent: 1, failed: 0 });
    expect(m.sendWhatsApp).toHaveBeenCalledTimes(1);
    expect(db.cronLaneLease.createMany.mock.calls[0][0]).toMatchObject({ skipDuplicates: true });
    expect(db.cronLaneLease.update).toHaveBeenCalledWith({ where: { lane: expect.stringMatching(/^wa-lead:l1:/) }, data: { holder: "SENT" } });
  });

  it("a failed send is left for the fast lane to retry once, with no admin alert yet", async () => {
    m.sendWhatsApp.mockResolvedValueOnce({ success: false, error: "502 Bad Gateway" });
    expect(await sendNewLeadWhatsApp("l1")).toEqual({ sent: 1, failed: 1 });
    const pending = db.cronLaneLease.update.mock.calls.find((c) => c[0].data.holder === "PENDING:1");
    expect(pending).toBeTruthy();
    expect(m.report).not.toHaveBeenCalled();
  });

  it("a send that timed out may have gone through, so it is never repeated", async () => {
    m.sendWhatsApp.mockResolvedValueOnce({ success: false, error: "AiSensy request timed out after 15000ms" });
    await sendNewLeadWhatsApp("l1");
    expect(db.cronLaneLease.update.mock.calls.some((c) => c[0].data.holder === "UNKNOWN")).toBe(true);
    expect(db.cronLaneLease.update.mock.calls.some((c) => String(c[0].data.holder).startsWith("PENDING"))).toBe(false);
  });

  it("never throws", async () => {
    db.lead.findUnique.mockRejectedValue(new Error("db down"));
    await expect(sendNewLeadWhatsApp("l1")).resolves.toMatchObject({ sent: 0 });
  });
});

describe("retryDueNewLeadWhatsApps", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEW_LEAD_ALERT_WHATSAPP_TEMPLATE = "new_lead_manager";
    db.lead.findUnique.mockResolvedValue(lead);
    db.cronLaneLease.update.mockResolvedValue({});
    db.cronLaneLease.updateMany.mockResolvedValue({ count: 1 });
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("retries once; a second failure tells the admins", async () => {
    db.cronLaneLease.findMany.mockResolvedValue([{ lane: "wa-lead:l1:+919800000002", holder: "PENDING:1" }]);
    m.sendWhatsApp.mockResolvedValue({ success: false, error: "not opted in" });
    await retryDueNewLeadWhatsApps(new Date());
    expect(m.sendWhatsApp.mock.calls[0][0].to).toBe("+919800000002");
    expect(db.cronLaneLease.update.mock.calls.at(-1)?.[0].data).toEqual({ holder: "FAILED" });
    expect(m.report).toHaveBeenCalledTimes(1);
    expect(m.report.mock.calls[0][0].detail).not.toContain("Priya");
  });

  it("finishes a send a restart cut short", async () => {
    db.cronLaneLease.findMany.mockResolvedValue([{ lane: "wa-lead:l1:+919800000002", holder: "PENDING:0" }]);
    m.sendWhatsApp.mockResolvedValue({ success: true });
    expect(await retryDueNewLeadWhatsApps(new Date())).toEqual({ retried: 1, sent: 1 });
  });

  it("skips a row another sweep already claimed", async () => {
    db.cronLaneLease.findMany.mockResolvedValue([{ lane: "wa-lead:l1:+919800000002", holder: "PENDING:1" }]);
    db.cronLaneLease.updateMany.mockResolvedValue({ count: 0 });
    await retryDueNewLeadWhatsApps(new Date());
    expect(m.sendWhatsApp).not.toHaveBeenCalled();
  });
});

describe("sendNewLeadWhatsApp duplicates", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEW_LEAD_ALERT_WHATSAPP_TEMPLATE = "new_lead_manager";
    process.env.NEW_LEAD_ALERT_WHATSAPP_TO = "nayana@x.in, 98450 12345";
    db.lead.findUnique.mockResolvedValue(lead);
    m.sendWhatsApp.mockResolvedValue({ success: true });
    db.cronLaneLease.createMany.mockResolvedValue({ count: 1 });
    db.cronLaneLease.update.mockResolvedValue({});
  });
  afterEach(() => {
    process.env = { ...saved };
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
