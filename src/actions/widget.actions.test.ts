import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  widgetInquiry: { findUnique: vi.fn(), updateMany: vi.fn() },
  lead: { findFirst: vi.fn() },
  contact: { findFirst: vi.fn(), create: vi.fn() },
}));
const createLead = vi.hoisted(() => vi.fn());

vi.mock("@/../auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1", role: "ADMIN" } })) }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/utils", () => ({ serialize: (x: unknown) => x }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn(async () => {}) }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("@/actions/lead.actions", () => ({ createLead }));

import { processInquiry } from "./widget.actions";

const inquiry = {
  id: "inq1",
  name: "Priya Sharma",
  email: "9800000000@noemail.veloria",
  phone: "9800000000",
  eventType: "Wedding",
  eventDate: null,
  guestCount: 200,
  message: "hi",
  isProcessed: false,
  createdAt: new Date("2026-11-23T10:00:00Z"),
};

describe("processInquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.widgetInquiry.findUnique.mockResolvedValue(inquiry);
    db.widgetInquiry.updateMany.mockResolvedValue({ count: 1 });
  });

  it("links to the lead the enquiry already became instead of creating a second one", async () => {
    db.lead.findFirst.mockResolvedValue({ id: "lead-1", contactId: "c1", contact: { id: "c1" } });
    const res = await processInquiry("inq1");
    expect(res.success).toBe(true);
    expect(createLead).not.toHaveBeenCalled();
    const where = db.lead.findFirst.mock.calls[0][0].where;
    // placeholder email is not used to match; the phone is, in both spellings
    expect(where.contact.OR).toEqual([{ phone: { in: ["9800000000", "+919800000000"] } }]);
  });

  it("still creates a lead when none exists for that person", async () => {
    db.lead.findFirst.mockResolvedValue(null);
    db.contact.findFirst.mockResolvedValue({ id: "c1" });
    createLead.mockResolvedValue({ success: true, data: { id: "lead-2" } });
    const res = await processInquiry("inq1");
    expect(res.success).toBe(true);
    expect(createLead).toHaveBeenCalledTimes(1);
  });
});
