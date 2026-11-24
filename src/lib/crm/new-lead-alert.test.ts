import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  lead: { findUnique: vi.fn(), findMany: vi.fn() },
  leadAlertDelivery: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
}));

const opsMock = vi.hoisted(() => ({ reportSystemFailure: vi.fn() }));

const emailMock = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: opsMock.reportSystemFailure }));
vi.mock("@/lib/email", () => ({
  sendEmail: emailMock.sendEmail,
  isEmailConfigured: emailMock.isEmailConfigured,
}));

import {
  parseAlertRecipients,
  buildNewLeadAlert,
  sendNewLeadAlert,
  enqueueNewLeadAlert,
  attemptLeadAlertDelivery,
  processDueLeadAlerts,
  retryDelayMinutes,
} from "./new-lead-alert";

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

  it("never splits an emoji when trimming a long message", async () => {
    db.lead.findUnique.mockResolvedValue({ ...leadRow, description: "a".repeat(599) + "😀 and more" });
    await sendNewLeadAlert("lead-1");
    const html: string = emailMock.sendEmail.mock.calls[0][0].html;
    expect(html).toContain("a".repeat(599) + "😀…");
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(html)).toBe(false);
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
    expect(await sendNewLeadAlert("lead-1")).toMatchObject({ sent: false, final: true });
    db.lead.findUnique.mockResolvedValue(null);
    expect(await sendNewLeadAlert("lead-1")).toMatchObject({ sent: false, final: true });
    expect(emailMock.sendEmail).not.toHaveBeenCalled();
  });

  it("reports a provider failure instead of throwing", async () => {
    emailMock.sendEmail.mockResolvedValue({ success: false, error: "SMTP refused" });
    expect(await sendNewLeadAlert("lead-1")).toEqual({ sent: false, reason: "SMTP refused" });
    db.lead.findUnique.mockRejectedValue(new Error("db down"));
    expect(await sendNewLeadAlert("lead-1")).toEqual({ sent: false, reason: "db down" });
  });
});

describe("durable delivery", () => {
  const saved = process.env.NEW_LEAD_ALERT_EMAILS;
  const NOW = new Date("2026-11-23T10:00:00Z");
  const row = (over: Record<string, unknown> = {}) => ({
    id: "d1",
    leadId: "lead-1",
    status: "PENDING",
    attempts: 1,
    createdAt: new Date("2026-11-23T09:59:00Z"),
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEW_LEAD_ALERT_EMAILS = LIST;
    emailMock.isEmailConfigured.mockReturnValue(true);
    emailMock.sendEmail.mockResolvedValue({ success: true });
    db.lead.findUnique.mockResolvedValue(leadRow);
    db.leadAlertDelivery.updateMany.mockResolvedValue({ count: 1 });
    db.leadAlertDelivery.findUnique.mockResolvedValue(row());
    db.leadAlertDelivery.update.mockResolvedValue({});
  });
  afterEach(() => {
    process.env.NEW_LEAD_ALERT_EMAILS = saved;
  });

  it("writes no record at all when no recipients are configured", async () => {
    process.env.NEW_LEAD_ALERT_EMAILS = "";
    await enqueueNewLeadAlert("lead-1");
    expect(db.leadAlertDelivery.upsert).not.toHaveBeenCalled();
  });

  it("records the alert once per lead and never re-sends one already sent", async () => {
    db.leadAlertDelivery.upsert.mockResolvedValue({ id: "d1", status: "SENT" });
    await enqueueNewLeadAlert("lead-1");
    expect(db.leadAlertDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadId: "lead-1" }, update: {} })
    );
    expect(db.leadAlertDelivery.updateMany).not.toHaveBeenCalled();
  });

  it("a phone lead gets no group email: it has already been spoken to", async () => {
    db.lead.findUnique.mockResolvedValue({ ...leadRow, source: "PHONE_INQUIRY" });
    await enqueueNewLeadAlert("lead-1");
    expect(db.leadAlertDelivery.upsert).not.toHaveBeenCalled();
    expect(emailMock.sendEmail).not.toHaveBeenCalled();
  });

  it("enqueue never throws, even if the database is down", async () => {
    db.leadAlertDelivery.upsert.mockRejectedValue(new Error("db down"));
    await expect(enqueueNewLeadAlert("lead-1")).resolves.toBeUndefined();
  });

  it("does nothing when another worker holds the claim", async () => {
    db.leadAlertDelivery.updateMany.mockResolvedValue({ count: 0 });
    expect(await attemptLeadAlertDelivery("d1", NOW)).toBe("skipped");
    expect(emailMock.sendEmail).not.toHaveBeenCalled();
  });

  it("marks the row SENT on success", async () => {
    expect(await attemptLeadAlertDelivery("d1", NOW)).toBe("sent");
    expect(db.leadAlertDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SENT" }) })
    );
  });

  it("schedules a retry when the mail server refuses", async () => {
    emailMock.sendEmail.mockResolvedValue({ success: false, error: "SMTP refused" });
    db.leadAlertDelivery.findUnique.mockResolvedValue(row({ attempts: 3 }));
    expect(await attemptLeadAlertDelivery("d1", NOW)).toBe("retry");
    const data = db.leadAlertDelivery.update.mock.calls[0][0].data;
    expect(data.lastError).toBe("SMTP refused");
    expect(data.nextAttemptAt.getTime()).toBe(NOW.getTime() + 5 * 60 * 1000);
    expect(data.status).toBeUndefined();
  });

  it("a give-up inside one attempt is returned, not reported there", async () => {
    emailMock.sendEmail.mockResolvedValue({ success: false, error: "SMTP refused" });
    db.leadAlertDelivery.findUnique.mockResolvedValue(
      row({ attempts: 170, createdAt: new Date("2026-11-15T09:00:00Z") })
    );
    expect(await attemptLeadAlertDelivery("d1", NOW)).toBe("gave_up");
    expect(db.leadAlertDelivery.update.mock.calls[0][0].data.status).toBe("FAILED");
    expect(opsMock.reportSystemFailure).not.toHaveBeenCalled();
  });

  it("stops quietly for a deleted lead or a setup problem, without retrying", async () => {
    db.lead.findUnique.mockResolvedValue({ ...leadRow, deletedAt: new Date() });
    expect(await attemptLeadAlertDelivery("d1", NOW)).toBe("failed");
    emailMock.isEmailConfigured.mockReturnValue(false);
    expect(await attemptLeadAlertDelivery("d1", NOW)).toBe("failed");
    expect(db.leadAlertDelivery.update.mock.calls.every((c) => c[0].data.status === "FAILED")).toBe(true);
    expect(opsMock.reportSystemFailure).not.toHaveBeenCalled();
  });

  describe("the 5-minute sweep", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    it("sends recent leads one by one and stops at its time budget", async () => {
      const recent = new Date(NOW.getTime() - 10 * 60 * 1000);
      db.leadAlertDelivery.findMany.mockResolvedValue([
        { id: "d1", createdAt: recent },
        { id: "d2", createdAt: recent },
      ]);
      expect(await processDueLeadAlerts(20, 45_000)).toMatchObject({ due: 2, sent: 2, digested: 0, deferred: 0 });
      vi.clearAllMocks();
      db.leadAlertDelivery.findMany.mockResolvedValue([
        { id: "d1", createdAt: recent },
        { id: "d2", createdAt: recent },
      ]);
      db.leadAlertDelivery.updateMany.mockResolvedValue({ count: 1 });
      expect(await processDueLeadAlerts(20, -1)).toMatchObject({ due: 2, sent: 0, deferred: 2 });
      expect(emailMock.sendEmail).not.toHaveBeenCalled();
    });

    it("sends long-overdue alerts as ONE 'delayed alerts' email, not a burst of 'New lead' emails", async () => {
      const old = new Date(NOW.getTime() - 26 * 60 * 60 * 1000);
      db.leadAlertDelivery.findMany.mockResolvedValue([
        { id: "d1", createdAt: old },
        { id: "d2", createdAt: old },
        { id: "d3", createdAt: old },
      ]);
      db.leadAlertDelivery.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        row({ id: where.id, leadId: `lead-${where.id}`, createdAt: old })
      );
      db.lead.findMany.mockResolvedValue([
        { ...leadRow, id: "lead-d1" },
        { ...leadRow, id: "lead-d2" },
        { ...leadRow, id: "lead-d3" },
      ]);
      const res = await processDueLeadAlerts(20, 45_000);
      expect(res).toMatchObject({ due: 3, sent: 0, digested: 3, gaveUp: 0 });
      expect(emailMock.sendEmail).toHaveBeenCalledTimes(1);
      const mail = emailMock.sendEmail.mock.calls[0][0];
      expect(mail.subject).toBe("Delayed lead alerts: 3 leads you may not have seen");
      expect(mail.to).toHaveLength(5);
      expect(mail.html).toContain("/leads/lead-d2");
    });

    it("reports give-ups to the admins once per sweep, however many there are", async () => {
      const ancient = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000);
      db.leadAlertDelivery.findMany.mockResolvedValue([
        { id: "d1", createdAt: ancient },
        { id: "d2", createdAt: ancient },
      ]);
      db.leadAlertDelivery.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        row({ id: where.id, createdAt: ancient })
      );
      const res = await processDueLeadAlerts(20, 45_000);
      expect(res.gaveUp).toBe(2);
      expect(emailMock.sendEmail).not.toHaveBeenCalled();
      expect(opsMock.reportSystemFailure).toHaveBeenCalledTimes(1);
      expect(opsMock.reportSystemFailure.mock.calls[0][0].title).toBe("2 new-lead alert emails could not be sent");
    });
  });

  it("backs off quickly at first, then hourly, then every 6 hours", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 24, 25, 50].map(retryDelayMinutes)).toEqual([1, 2, 5, 10, 15, 30, 60, 60, 360, 360]);
  });
});
