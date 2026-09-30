import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Delivery-status webhooks: a provider that accepts a message and later
// reports it FAILED says why (Meta `errors[0]`, AiSensy `failureResponse`,
// Weflux `error`). That reason used to be dropped, leaving a bare "FAILED" in
// the console; it is now stored as failureReason, and cleared again by a
// later non-failure status. Prisma is mocked.
// ============================================================

const db = vi.hoisted(() => ({
  whatsAppConfig: { findFirst: vi.fn() },
  whatsAppMessage: { updateMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  contact: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/lead-capture", () => ({ captureLeadFromExternal: vi.fn() }));
vi.mock("@/lib/lead-pipeline", () => ({ handleInboundReply: vi.fn() }));

import { processAiSensyEvent, processMetaWebhookPayload, processWefluxEvent } from "./inbound-pipeline";

const DETAILS =
  "Message failed to send because more than 24 hours have passed since the customer last replied to this number.";

function metaStatus(status: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "PNID" }, statuses: [status] } }] }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.whatsAppConfig.findFirst.mockResolvedValue({ phoneNumberId: "PNID" });
  db.whatsAppMessage.updateMany.mockResolvedValue({ count: 1 });
  db.whatsAppMessage.findFirst.mockResolvedValue(null);
  db.whatsAppMessage.create.mockResolvedValue({ id: "wm1" });
  db.contact.findFirst.mockResolvedValue({ id: "c1" });
});

describe("Meta status webhook", () => {
  it("stores Meta's code, title and details when a message fails", async () => {
    await processMetaWebhookPayload(
      metaStatus({
        id: "wamid.X",
        status: "failed",
        errors: [{ code: 131047, title: "Re-engagement message", message: "Re-engagement message", error_data: { details: DETAILS } }],
      })
    );
    expect(db.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { whatsappId: "wamid.X" },
      data: { status: "FAILED", failureReason: `Delivery failed [131047]: Re-engagement message — ${DETAILS}` },
    });
  });

  it("still says the delivery failed when Meta gives no reason", async () => {
    await processMetaWebhookPayload(metaStatus({ id: "wamid.X", status: "failed" }));
    expect(db.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { whatsappId: "wamid.X" },
      data: { status: "FAILED", failureReason: "Delivery failed (no reason returned by provider)" },
    });
  });

  it("clears the reason on a delivered status", async () => {
    await processMetaWebhookPayload(metaStatus({ id: "wamid.X", status: "delivered" }));
    expect(db.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { whatsappId: "wamid.X" },
      data: { status: "DELIVERED", failureReason: null },
    });
  });
});

describe("AiSensy status webhook", () => {
  it("stores failureResponse on the row, under both ids AiSensy sends", async () => {
    await processAiSensyEvent({
      id: "n1",
      topic: "message.status.updated",
      data: {
        message: {
          id: "aisensy-1",
          messageId: "wamid.Y",
          phone_number: "919876543210",
          status: "FAILED",
          failed_at: 1727600001000,
          failureResponse: { code: 131047, reason: "Re-engagement message" },
        },
      },
    });
    const expected = { status: "FAILED", failureReason: "Delivery failed [131047]: Re-engagement message" };
    expect(db.whatsAppMessage.updateMany).toHaveBeenCalledWith({ where: { whatsappId: "wamid.Y" }, data: expected });
    expect(db.whatsAppMessage.updateMany).toHaveBeenCalledWith({ where: { whatsappId: "aisensy-1" }, data: expected });
  });
});

describe("Weflux webhooks", () => {
  it("stores the reason from a failed message.status event", async () => {
    await processWefluxEvent({
      event: "message.status",
      message: { id: "wf-1", status: "failed", error: { code: 131026, message: "Receiver is incapable of receiving this message" } },
    });
    expect(db.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { whatsappId: "wf-1" },
      data: { status: "FAILED", failureReason: "Delivery failed [131026]: Receiver is incapable of receiving this message" },
    });
  });

  it("stores the reason on a mirrored outbound message that Weflux reports as failed", async () => {
    await processWefluxEvent({
      event: "message.sent",
      message: { id: "wf-2", phone: "919876543210", text: "Hello", status: "failed", reason: "Template paused by Meta" },
    });
    expect(db.whatsAppMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        direction: "OUTBOUND",
        status: "FAILED",
        whatsappId: "wf-2",
        failureReason: "Delivery failed: Template paused by Meta",
        contactId: "c1",
      }),
    });
  });
});
