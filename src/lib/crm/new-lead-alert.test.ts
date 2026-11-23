import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  lead: { findUnique: vi.fn() },
}));

const emailMock = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/email", () => ({
  sendEmail: emailMock.sendEmail,
  isEmailConfigured: emailMock.isEmailConfigured,
}));

import { parseAlertRecipients, buildNewLeadAlert, sendNewLeadAlert } from "./new-lead-alert";

const LIST =
  "sunitha@billionevents.in, rajitha@propertyplush.com,nayana@billionevents.in; meera@billionevents.in venkat@theveloriagrand.com";

const leadRow = {
  id: "lead-1",
  title: "Wedding enquiry",
  description: "Looking for a hall in Whitefield [ext:gads-123]",
  source: "GOOGLE_ADS",
  eventType: "Wedding",
  eventDate: new Date("2027-02-14T00:00:00Z"),
  guestCount: 250,
  createdAt: new Date("2026-11-23T06:30:00Z"), // 12:00 noon IST
  deletedAt: null,
  preferredVenue: { name: "Veloria Grand Whitefield" },
  assignedTo: { name: "Asha" },
  contact: { firstName: "Priya", lastName: "Sharma", phone: "+919800000000", email: "priya@example.com" },
};

describe("parseAlertRecipients", () => {
  it("accepts comma, semicolon and space separators, lowercases and dedupes", () => {
    expect(parseAlertRecipients(LIST + ", SUNITHA@billionevents.in")).toEqual([
      "sunitha@billionevents.in",
      "rajitha@propertyplush.com",
      "nayana@billionevents.in",
      "meera@billionevents.in",
      "venkat@theveloriagrand.com",
    ]);
  });

  it("drops junk and returns [] for empty input", () => {
    expect(parseAlertRecipients("not-an-email, a@b, ,x@y.z")).toEqual(["x@y.z"]);
    expect(parseAlertRecipients("")).toEqual([]);
    expect(parseAlertRecipients(undefined)).toEqual([]);
  });
});

describe("buildNewLeadAlert", () => {
  const base = {
    leadId: "lead-1",
    title: "Wedding enquiry",
    name: "Priya Sharma",
    phone: "+919800000000",
    email: "priya@example.com",
    source: "GOOGLE_ADS",
    eventType: "Wedding",
    eventDate: new Date("2027-02-14T00:00:00Z"),
    guestCount: 250,
    venue: "Veloria Grand Whitefield",
    assignedTo: "Asha",
    receivedAt: new Date("2026-11-23T06:30:00Z"),
    notes: "Looking for a hall",
  };

  it("puts the essentials in the subject and body with readable labels and IST time", () => {
    const { subject, html } = buildNewLeadAlert(base);
    expect(subject).toBe("New lead: Priya Sharma · Wedding · Google Ads");
    expect(html).toContain("+919800000000");
    expect(html).toContain("Veloria Grand Whitefield");
    expect(html).toContain("Asha");
    expect(html).toMatch(/12:00\s*pm IST/i);
    expect(html).toContain("/leads/lead-1");
  });

  it("escapes customer-supplied text", () => {
    const { html } = buildNewLeadAlert({ ...base, name: '<script>x</script>', notes: 'a "b" <i>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;b&quot;");
  });

  it("says when nobody is assigned and falls back to the title without a name", () => {
    const { subject, html } = buildNewLeadAlert({ ...base, name: "", assignedTo: null, eventType: null });
    expect(subject).toBe("New lead: Wedding enquiry · Google Ads");
    expect(html).toContain("Not assigned yet");
  });
});

describe("sendNewLeadAlert", () => {
  const saved = process.env.NEW_LEAD_ALERT_EMAILS;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEW_LEAD_ALERT_EMAILS = LIST;
    emailMock.isEmailConfigured.mockReturnValue(true);
    emailMock.sendEmail.mockResolvedValue({ success: true });
    db.lead.findUnique.mockResolvedValue(leadRow);
  });
  afterEach(() => {
    process.env.NEW_LEAD_ALERT_EMAILS = saved;
  });

  it("sends one email to every configured recipient", async () => {
    const res = await sendNewLeadAlert("lead-1");
    expect(res).toEqual({ sent: true });
    expect(emailMock.sendEmail).toHaveBeenCalledTimes(1);
    const arg = emailMock.sendEmail.mock.calls[0][0];
    expect(arg.to).toHaveLength(5);
    expect(arg.to).toContain("rajitha@propertyplush.com");
    expect(arg.subject).toBe("New lead: Priya Sharma · Wedding · Google Ads");
    // internal dedupe marker never reaches the email
    expect(arg.html).not.toContain("[ext:");
    expect(arg.html).toContain("Looking for a hall in Whitefield");
  });

  it("does nothing when no recipients are configured", async () => {
    process.env.NEW_LEAD_ALERT_EMAILS = "";
    expect(await sendNewLeadAlert("lead-1")).toEqual({ sent: false, reason: "No alert recipients configured" });
    expect(db.lead.findUnique).not.toHaveBeenCalled();
  });

  it("does nothing when email is not configured", async () => {
    emailMock.isEmailConfigured.mockReturnValue(false);
    expect(await sendNewLeadAlert("lead-1")).toEqual({ sent: false, reason: "Email service not configured" });
    expect(emailMock.sendEmail).not.toHaveBeenCalled();
  });

  it("skips a deleted or missing lead", async () => {
    db.lead.findUnique.mockResolvedValue({ ...leadRow, deletedAt: new Date() });
    expect((await sendNewLeadAlert("lead-1")).sent).toBe(false);
    db.lead.findUnique.mockResolvedValue(null);
    expect((await sendNewLeadAlert("lead-1")).sent).toBe(false);
    expect(emailMock.sendEmail).not.toHaveBeenCalled();
  });

  it("reports a provider failure instead of throwing", async () => {
    emailMock.sendEmail.mockResolvedValue({ success: false, error: "SMTP refused" });
    expect(await sendNewLeadAlert("lead-1")).toEqual({ sent: false, reason: "SMTP refused" });
    db.lead.findUnique.mockRejectedValue(new Error("db down"));
    expect(await sendNewLeadAlert("lead-1")).toEqual({ sent: false, reason: "db down" });
  });
});
