import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Review-request backlog guard. The daily sweep retried every PENDING/FAILED
// request with no age limit, so a fixed WhatsApp provider would have asked
// customers to review events from months ago. Only events in the last
// REVIEW_REQUEST_MAX_AGE_DAYS are picked now; older rows are left untouched.
// ============================================================

const db = vi.hoisted(() => ({
  booking: { findMany: vi.fn(), findUnique: vi.fn() },
  reviewRequest: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  whatsAppMessage: { create: vi.fn() },
}));
const sendWhatsApp = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp }));

import {
  enqueueReviewRequestForBooking,
  enqueueReviewRequestsForCompletedBookings,
  REVIEW_REQUEST_MAX_AGE_DAYS,
  reviewRequestCutoff,
} from "./review-request";

const NOW = new Date("2026-09-30T20:30:00.000Z");
const CUTOFF = new Date("2026-08-31T00:00:00.000Z"); // Booking.date is a UTC-midnight @db.Date

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  db.booking.findMany.mockResolvedValue([]);
  db.reviewRequest.findMany.mockResolvedValue([]);
  db.reviewRequest.create.mockResolvedValue({});
  db.reviewRequest.updateMany.mockResolvedValue({ count: 1 });
  db.whatsAppMessage.create.mockResolvedValue({});
  sendWhatsApp.mockResolvedValue({ success: true, messageId: "wamid.1" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("review-request age limit", () => {
  it("is 30 days, counted in whole event days", () => {
    expect(REVIEW_REQUEST_MAX_AGE_DAYS).toBe(30);
    expect(reviewRequestCutoff(NOW)).toEqual(CUTOFF);
  });

  it("only enqueues, and only sends or retries, for events in the last 30 days", async () => {
    await enqueueReviewRequestsForCompletedBookings();

    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "COMPLETED", date: { gte: CUTOFF }, reviewRequests: { none: {} } },
      })
    );
    expect(db.reviewRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["PENDING", "FAILED"] }, booking: { date: { gte: CUTOFF } } },
      })
    );
    // Older rows are not rewritten or closed: the guard only stops picking them.
    expect(db.reviewRequest.update).not.toHaveBeenCalled();
    expect(db.reviewRequest.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a manual request for an event more than 30 days ago, without writing anything", async () => {
    db.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "COMPLETED",
      contactId: "c1",
      date: new Date("2026-08-30T00:00:00.000Z"),
    });

    await expect(enqueueReviewRequestForBooking("b1")).resolves.toEqual({
      ok: false,
      error: "Review requests are only sent within 30 days of the event",
    });
    expect(db.reviewRequest.create).not.toHaveBeenCalled();
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it("still sends a manual request for an event exactly 30 days ago", async () => {
    db.booking.findUnique.mockResolvedValue({ id: "b1", status: "COMPLETED", contactId: "c1", date: CUTOFF });
    db.reviewRequest.findUnique.mockResolvedValue({
      id: "rr1",
      token: "tok",
      status: "PENDING",
      contactId: "c1",
      contact: { firstName: "Priya", lastName: "Rao", phone: "+91 98450 12345" },
      booking: { eventName: "Reception" },
    });

    await expect(enqueueReviewRequestForBooking("b1")).resolves.toEqual({ ok: true, outcome: "sent", alreadyExisted: false });
    expect(sendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ template: "review_request" }));
  });
});
