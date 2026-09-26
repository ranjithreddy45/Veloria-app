import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// convertDealToBooking follows the team booking form's slot rules: the event
// day is stored and matched as a UTC day (Booking.date and BlackoutDate.date
// are @db.Date), lapsed holds on the slot are released before the transaction,
// and the transaction's own clash check still decides.
// ============================================================

const h = vi.hoisted(() => ({
  db: {
    deal: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn() },
    blackoutDate: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: {
    booking: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    lead: { update: vi.fn(), findUnique: vi.fn() },
    pipelineStage: { findFirst: vi.fn() },
    deal: { update: vi.fn() },
  },
  releaseForSlot: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.db }));
vi.mock("@/../auth", () => ({ auth: async () => ({ user: { id: "rep-1", role: "SALES_HEAD" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("@/lib/approval-engine", () => ({ requestApprovalIfNeeded: async () => null }));
vi.mock("@/lib/velos/triggers", () => ({ velosOnDealStage: async () => {} }));
vi.mock("@/lib/lead-scoring", () => ({ calculateLeadScore: () => 0 }));
vi.mock("@/lib/holds/release-lapsed-holds", () => ({ releaseLapsedHoldsForSlot: h.releaseForSlot }));

import { convertDealToBooking } from "./pipeline.actions";

const DAY = new Date("2030-01-20T00:00:00.000Z");
const NEXT_DAY = new Date("2030-01-21T00:00:00.000Z");
// What the convert dialog sends: the local "YYYY-MM-DD" of its date input.
const INPUT = {
  dealId: "deal-1",
  venueId: "venue-1",
  eventName: "Rao Wedding",
  date: "2030-01-20",
  timeSlot: "EVENING",
  guestCount: 300,
  totalAmount: 450000,
};

beforeEach(() => {
  vi.resetAllMocks();
  h.db.deal.findUnique.mockResolvedValue({
    id: "deal-1",
    leadId: "lead-1",
    stageId: "stage-open",
    lead: { eventType: "WEDDING", contact: { id: "contact-1" } },
  });
  h.db.booking.findUnique.mockResolvedValue(null);
  h.db.blackoutDate.findMany.mockResolvedValue([]);
  h.db.$transaction.mockImplementation(async (fn: (tx: typeof h.tx) => unknown) => fn(h.tx));
  h.tx.booking.findMany.mockResolvedValue([]);
  h.tx.booking.count.mockResolvedValue(10);
  h.tx.booking.create.mockResolvedValue({ id: "bk-1", bookingNumber: "BK-2026-0011" });
  h.tx.lead.update.mockResolvedValue({});
  // convertDealToBooking now reads the lead first: the booking it is creating
  // supplies the booking value that Won requires, and the once-only Won/
  // Qualified timestamps reported to Google Ads.
  h.tx.lead.findUnique.mockResolvedValue({ bookingValue: null, qualifiedAt: null, wonAt: null });
  h.tx.pipelineStage.findFirst.mockResolvedValue({ id: "stage-won" });
  h.tx.deal.update.mockResolvedValue({});
  h.releaseForSlot.mockResolvedValue(0);
});

describe("convertDealToBooking and the shared slot rules", () => {
  it("stores the UTC day, matches blackouts and clashes over that day, and releases lapsed holds first", async () => {
    const res = await convertDealToBooking(INPUT);

    expect(res).toEqual({ success: true, data: { bookingId: "bk-1", bookingNumber: "BK-2026-0011" } });
    expect(h.db.blackoutDate.findMany.mock.calls[0][0].where).toMatchObject({ venueId: "venue-1", date: { gte: DAY, lt: NEXT_DAY } });
    expect(h.releaseForSlot).toHaveBeenCalledWith("venue-1", DAY, "EVENING", expect.any(Date));
    expect(h.releaseForSlot.mock.invocationCallOrder[0]).toBeLessThan(h.db.$transaction.mock.invocationCallOrder[0]);
    expect(h.tx.booking.findMany.mock.calls[0][0].where).toMatchObject({
      venueId: "venue-1",
      date: { gte: DAY, lt: NEXT_DAY },
      status: { notIn: ["CANCELLED"] },
      timeSlot: { in: ["EVENING", "FULL_DAY"] },
    });
    // HOLD, not CONFIRMED: a converted deal holds the slot and confirms itself
    // once the 20% advance lands, like every other booking path.
    expect(h.tx.booking.create.mock.calls[0][0].data).toMatchObject({ date: DAY, timeSlot: "EVENING", status: "HOLD" });
  });

  it("refuses a blackout stored on that day, before releasing or booking anything", async () => {
    h.db.blackoutDate.findMany.mockResolvedValue([{ date: DAY, reason: "Renovation" }]);

    expect(await convertDealToBooking(INPUT)).toEqual({ success: false, error: "Venue is blacked out: Renovation" });
    expect(h.releaseForSlot).not.toHaveBeenCalled();
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });

  it("still refuses the slot when a booking on that day remains after the release", async () => {
    h.tx.booking.findMany.mockResolvedValue([{ id: "bk-paid-hold", date: DAY }]);

    expect(await convertDealToBooking(INPUT)).toEqual({ success: false, error: "That slot was just taken — please pick another." });
    expect(h.tx.booking.create).not.toHaveBeenCalled();
  });

  it("logs a failed release and lets the transaction's clash check decide", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.releaseForSlot.mockRejectedValue(new Error("connection lost"));

    const res = await convertDealToBooking(INPUT);

    expect(res.success).toBe(true);
    expect(spy).toHaveBeenCalledWith("[CONVERT_DEAL_LAPSED_RELEASE_ERROR]", expect.any(Error));
    spy.mockRestore();
  });

  it("rejects an unknown time slot before touching the calendar", async () => {
    expect(await convertDealToBooking({ ...INPUT, timeSlot: "NIGHT" })).toEqual({ success: false, error: "Invalid time slot" });
    expect(h.db.blackoutDate.findMany).not.toHaveBeenCalled();
  });
});
