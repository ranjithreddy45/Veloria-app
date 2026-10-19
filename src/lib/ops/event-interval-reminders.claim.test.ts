import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  booking: { findMany: vi.fn() },
  eventReminderLog: { create: vi.fn() },
  operationVendorAssignment: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  galleryItem: { count: vi.fn() },
}));
const sendWhatsApp = vi.hoisted(() => vi.fn(async () => ({ success: true })));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp }));
vi.mock("@/lib/sms", () => ({ sendSMSFireAndForget: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyAwait: vi.fn(async () => {}) }));

import { runEventIntervalReminders } from "./event-interval-reminders";

beforeEach(() => {
  vi.clearAllMocks();
  const start = new Date(Date.now() + 3 * 3600_000); // ~3h out → the 4h bucket sends
  db.booking.findMany.mockResolvedValue([
    { id: "b1", bookingNumber: "B-1", eventName: "Reception", date: start, timeSlot: "EVENING", eventStartAt: start,
      contact: { phone: "+919000000001", firstName: "A" }, venue: { name: "Hall" }, createdById: "u" },
  ]);
  db.operationVendorAssignment.findMany.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([]);
  db.galleryItem.count.mockResolvedValue(1);
});

describe("event-interval reminders claim before sending (R1-1)", () => {
  it("sends the guest reminder once when this run creates the log row", async () => {
    db.eventReminderLog.create.mockResolvedValue({});
    await runEventIntervalReminders();
    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
  });
  it("sends nothing when another run already claimed every reminder", async () => {
    db.eventReminderLog.create.mockRejectedValue(Object.assign(new Error("Unique constraint"), { code: "P2002" }));
    await runEventIntervalReminders();
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });
});
