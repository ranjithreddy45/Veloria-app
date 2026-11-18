import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { sendLeadWelcomeEmail } from "./lead-welcome-email";

describe("sendLeadWelcomeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not configured if email service is not configured", async () => {
    emailMock.isEmailConfigured.mockReturnValue(false);

    const res = await sendLeadWelcomeEmail("lead-1");
    expect(res).toEqual({ sent: false, reason: "Email service not configured" });
    expect(db.lead.findUnique).not.toHaveBeenCalled();
  });

  it("returns Lead not found when lead does not exist", async () => {
    emailMock.isEmailConfigured.mockReturnValue(true);
    db.lead.findUnique.mockResolvedValue(null);

    const res = await sendLeadWelcomeEmail("lead-missing");
    expect(res).toEqual({ sent: false, reason: "Lead not found" });
  });

  it("returns Contact has no email address when contact email is absent", async () => {
    emailMock.isEmailConfigured.mockReturnValue(true);
    db.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      title: "Wedding Enquiry",
      eventType: "Wedding",
      eventDate: null,
      guestCount: 200,
      contact: {
        id: "c-1",
        firstName: "Aarav",
        lastName: "Sharma",
        email: null,
        phone: "+919876543210",
      },
      assignedTo: null,
    });

    const res = await sendLeadWelcomeEmail("lead-1");
    expect(res).toEqual({ sent: false, reason: "Contact has no email address" });
    expect(emailMock.sendEmail).not.toHaveBeenCalled();
  });

  it("sends welcome email successfully when contact has an email address", async () => {
    emailMock.isEmailConfigured.mockReturnValue(true);
    db.lead.findUnique.mockResolvedValue({
      id: "lead-1",
      title: "Wedding Enquiry",
      eventType: "Wedding",
      eventDate: new Date("2026-12-25T00:00:00Z"),
      guestCount: 350,
      contact: {
        id: "c-1",
        firstName: "Aarav",
        lastName: "Sharma",
        email: "aarav@example.com",
        phone: "+919876543210",
      },
      assignedTo: {
        name: "Pooja Mehta",
        email: "pooja@theveloriagrand.com",
      },
    });

    emailMock.sendEmail.mockResolvedValue({ success: true, messageId: "msg-123" });

    const res = await sendLeadWelcomeEmail("lead-1");
    expect(res).toEqual({ sent: true });
    expect(emailMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "aarav@example.com",
        subject: "Thank you for reaching out to Veloria Grand | Enquiry Received",
      })
    );

    const callArgs = emailMock.sendEmail.mock.calls[0][0];
    expect(callArgs.html).toContain("Warm Greetings, Aarav!");
    expect(callArgs.html).toContain("Wedding");
    expect(callArgs.html).toContain("350 guests");
    expect(callArgs.html).toContain("Pooja Mehta");
  });
});
