import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Cadence SEND_WHATSAPP step: the WhatsAppMessage row is written before the
// send (unchanged), then corrected to what actually happened. It used to stay
// SENT whatever the provider said, so a provider outage looked like a string
// of successful sends. Prisma and the provider are mocked.
// ============================================================

const db = vi.hoisted(() => ({
  cadenceEnrollment: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  cadenceEnrollmentStep: { create: vi.fn() },
  contact: { findUnique: vi.fn() },
  lead: { findUnique: vi.fn() },
  whatsAppMessage: { create: vi.fn(), update: vi.fn() },
}));
const sendWhatsApp = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/integrations/sms", () => ({ sendSms: vi.fn() }));
vi.mock("@/lib/email-tracking", () => ({ processEmailForTracking: vi.fn() }));

import { processDueCadenceSteps } from "./cadence-executor";

function dueWhatsAppStep(phone: string | null) {
  db.cadenceEnrollment.findMany.mockResolvedValue([
    {
      id: "enr1",
      status: "ACTIVE",
      currentStepOrder: 1,
      nextExecuteAt: new Date(0),
      entityId: "c1",
      enrolledById: "u1",
      createdAt: new Date(0),
      cadence: {
        entityType: "CONTACT",
        steps: [
          { id: "step1", order: 1, stepType: "SEND_WHATSAPP", config: { message: "Hi Priya" }, delayDays: 0, delayHours: 0 },
        ],
      },
    },
  ]);
  db.contact.findUnique.mockResolvedValue({ email: null, phone });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  db.cadenceEnrollment.updateMany.mockResolvedValue({ count: 1 });
  db.cadenceEnrollment.update.mockResolvedValue({});
  db.cadenceEnrollmentStep.create.mockResolvedValue({});
  db.whatsAppMessage.create.mockResolvedValue({ id: "wm1" });
  db.whatsAppMessage.update.mockResolvedValue({});
});

describe("cadence SEND_WHATSAPP", () => {
  it("marks the row FAILED with the provider's reason when the send fails", async () => {
    dueWhatsAppStep("+91 98450 12345");
    sendWhatsApp.mockResolvedValue({ success: false, error: "AiSensy HTTP 400 [ERR400]: template not found" });

    await expect(processDueCadenceSteps()).resolves.toEqual({ processed: 1, errors: 0 });

    expect(sendWhatsApp).toHaveBeenCalledWith({ to: "+91 98450 12345", message: "Hi Priya", template: undefined });
    expect(db.whatsAppMessage.update).toHaveBeenCalledWith({
      where: { id: "wm1" },
      data: { status: "FAILED", failureReason: "AiSensy HTTP 400 [ERR400]: template not found" },
    });
  });

  it("stores the provider message id and no reason when the send succeeds", async () => {
    dueWhatsAppStep("+91 98450 12345");
    sendWhatsApp.mockResolvedValue({ success: true, messageId: "wamid.OK" });

    await processDueCadenceSteps();

    expect(db.whatsAppMessage.update).toHaveBeenCalledWith({
      where: { id: "wm1" },
      data: { whatsappId: "wamid.OK", failureReason: null },
    });
  });

  it("records a contact without a phone as FAILED instead of a send that never happened", async () => {
    dueWhatsAppStep(null);

    await processDueCadenceSteps();

    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(db.whatsAppMessage.update).toHaveBeenCalledWith({
      where: { id: "wm1" },
      data: { status: "FAILED", failureReason: "Contact has no phone number" },
    });
  });

  it("does not re-run the step (and message the customer twice) when the row update fails", async () => {
    dueWhatsAppStep("+91 98450 12345");
    sendWhatsApp.mockResolvedValue({ success: true, messageId: "wamid.OK" });
    db.whatsAppMessage.update.mockRejectedValue(new Error("connection reset"));

    await expect(processDueCadenceSteps()).resolves.toEqual({ processed: 1, errors: 0 });

    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
    expect(db.cadenceEnrollmentStep.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ enrollmentId: "enr1", stepId: "step1", status: "EXECUTED" }),
    });
  });
});
