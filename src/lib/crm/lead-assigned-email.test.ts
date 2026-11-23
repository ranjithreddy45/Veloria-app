import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({ lead: { findUnique: vi.fn() }, user: { findUnique: vi.fn() } }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn(), isEmailConfigured: vi.fn(() => true) }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/email", () => mail);

import { sendLeadAssignedEmail } from "./lead-assigned-email";

const NOW = new Date("2026-11-23T10:00:00Z");
const lead = (over: Record<string, unknown> = {}) => ({
  id: "l1",
  title: "Wedding enquiry",
  source: "GOOGLE_ADS",
  eventType: "Wedding",
  eventDate: new Date("2027-02-14T00:00:00Z"),
  guestCount: 250,
  estimatedValue: 450000,
  firstContactDue: new Date(NOW.getTime() + 15 * 60 * 1000),
  firstRespondedAt: null,
  description: "Need a hall [ext:x1]",
  preferredVenue: { name: "Whitefield" },
  contact: { firstName: "Priya", lastName: "Sharma", phone: "+91 98000 00000", email: "p@x.in" },
  ...over,
});

describe("sendLeadAssignedEmail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue({ name: "Asha", email: "asha@x.in", isActive: true });
    mail.sendEmail.mockResolvedValue({ success: true });
  });
  afterEach(() => vi.useRealTimers());

  it("a new lead: readable details, tap-to-call, deadline in IST", async () => {
    db.lead.findUnique.mockResolvedValue(lead());
    await sendLeadAssignedEmail("l1", "u1", { assignedByName: "Sunitha", isNew: true });
    const m = mail.sendEmail.mock.calls[0][0];
    expect(m.subject).toBe("New lead assigned: Priya Sharma");
    expect(m.html).toContain('href="tel:+919800000000"');
    expect(m.html).toContain("Google Ads");
    expect(m.html).not.toContain("GOOGLE_ADS");
    expect(m.html).toContain("14 Feb 2027");
    expect(m.html).toContain("Whitefield");
    expect(m.html).toContain("₹4,50,000");
    expect(m.html).toContain("Need a hall");
    expect(m.html).not.toContain("[ext:");
    expect(m.html).toMatch(/Please call by .*3:45\s*pm IST/i);
    expect(m.html).not.toContain("UTC");
  });

  it("a reassigned old lead: not called new, and no stale deadline", async () => {
    db.lead.findUnique.mockResolvedValue(lead({ firstContactDue: new Date("2026-10-01T05:00:00Z") }));
    await sendLeadAssignedEmail("l1", "u1", { assignedByName: "Sunitha", isNew: false });
    const m = mail.sendEmail.mock.calls[0][0];
    expect(m.subject).toBe("Lead assigned to you: Priya Sharma");
    expect(m.html).toContain("A lead has been assigned to you");
    expect(m.html).not.toContain("Please call by");
  });

  it("no deadline once someone has already responded", async () => {
    db.lead.findUnique.mockResolvedValue(lead({ firstRespondedAt: new Date() }));
    await sendLeadAssignedEmail("l1", "u1", {});
    expect(mail.sendEmail.mock.calls[0][0].html).not.toContain("Please call by");
  });
});
