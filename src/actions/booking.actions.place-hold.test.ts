import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// placeHold serves the booking page's Place Hold (a TENTATIVE booking) and
// Extend hold (a HOLD). The server checks everything again: bookings:update,
// the hours (whole, 1 to 168), that an extension ends the hold later than now,
// that a hold whose window passed only gets its date back while the slot is
// free, and that the booking hasn't changed since it was read. Every change is
// on the ActivityLog. Prisma and the framework are stubbed; the hold rules are
// real.
// ============================================================

const { db, authMock, permissionMock, logActivityMock } = vi.hoisted(() => {
  const table = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  });
  return {
    db: { booking: table(), blackoutDate: table(), $transaction: vi.fn() },
    authMock: vi.fn(),
    permissionMock: vi.fn(),
    logActivityMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/permissions", () => ({
  hasPermission: (role: string, permission: string) => permissionMock(role, permission),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: (params: unknown) => logActivityMock(params) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => undefined) }));
vi.mock("@/lib/sms", () => ({ sendSMSFireAndForget: vi.fn() }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn(async () => undefined) }));
vi.mock("@/lib/email-templates/booking-confirmation", () => ({ bookingConfirmationEmail: vi.fn(() => "") }));
vi.mock("@/lib/workflow-executor", () => ({ triggerWorkflows: vi.fn() }));
vi.mock("@/lib/approval-engine", () => ({ requestApprovalIfNeeded: vi.fn() }));
vi.mock("@/lib/velos/award", () => ({ awardVelos: vi.fn() }));
vi.mock("@/lib/sales/booking-confirmation-artifacts", () => ({ initBookingConfirmationArtifacts: vi.fn() }));

import { placeHold } from "./booking.actions";
import { HOLD_CHANGED_ERROR, HOLD_SLOT_TAKEN_ERROR, holdChangeError } from "@/lib/holds/hold-extension";

const NOW = new Date("2026-09-16T10:00:00.000Z");
const DAY = new Date("2027-01-20T00:00:00.000Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000);
const unpaid = { status: "SENT", paidAmount: 0, payments: [] };

/** The booking placeHold reads. By default a HOLD whose window passed 3 hours ago. */
function booking(over: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    bookingNumber: "VG-2027-0042",
    status: "HOLD",
    holdExpiresAt: hoursFromNow(-3),
    venueId: "venue-1",
    date: DAY,
    timeSlot: "EVENING",
    ...over,
  };
}

/** Another booking at the same venue on the same day. */
function other(over: Record<string, unknown> = {}) {
  return { id: "other-1", status: "CONFIRMED", holdExpiresAt: null, date: DAY, timeSlot: "EVENING", invoices: [unpaid], ...over };
}

/** The booking as read before the write, then as re-read after it. */
function reads(before: Record<string, unknown>, after: Record<string, unknown> = before) {
  db.booking.findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  authMock.mockResolvedValue({ user: { id: "user-1", role: "SALES_EXEC" } });
  permissionMock.mockReturnValue(true);
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  db.booking.findMany.mockResolvedValue([]);
  db.blackoutDate.findMany.mockResolvedValue([]);
  db.booking.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("placeHold: Place Hold", () => {
  it("places a tentative booking on hold for the chosen hours, pinned to TENTATIVE, and logs it", async () => {
    reads(booking({ status: "TENTATIVE", holdExpiresAt: null }), booking({ holdExpiresAt: hoursFromNow(48) }));

    const res = await placeHold("booking-1", 48);

    expect(res.success).toBe(true);
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "booking-1", status: "TENTATIVE" },
      data: { status: "HOLD", holdExpiresAt: hoursFromNow(48) },
    });
    expect(db.booking.findMany).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith({
      userId: "user-1",
      action: "placed_hold",
      entityType: "Booking",
      entityId: "booking-1",
      changes: {
        bookingNumber: "VG-2027-0042",
        hours: 48,
        fromStatus: "TENTATIVE",
        fromHoldExpiresAt: null,
        holdExpiresAt: hoursFromNow(48).toISOString(),
      },
    });
  });

  it("a tentative booking that changed before the write is not placed", async () => {
    reads(booking({ status: "TENTATIVE", holdExpiresAt: null }));
    db.booking.updateMany.mockResolvedValue({ count: 0 });

    expect(await placeHold("booking-1", 24)).toEqual({ success: false, error: HOLD_CHANGED_ERROR });
    expect(logActivityMock).not.toHaveBeenCalled();
  });
});

describe("placeHold: Extend hold", () => {
  it("extends a hold inside its window to end later, pinned to the hold as read, with no slot check", async () => {
    const current = hoursFromNow(2);
    reads(booking({ holdExpiresAt: current }));

    const res = await placeHold("booking-1", 24);

    expect(res.success).toBe(true);
    expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "booking-1", status: "HOLD", holdExpiresAt: current },
      data: { holdExpiresAt: hoursFromNow(24) },
    });
    expect(db.booking.findMany).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "extended_hold",
        entityId: "booking-1",
        changes: expect.objectContaining({
          hours: 24,
          fromStatus: "HOLD",
          fromHoldExpiresAt: current.toISOString(),
          holdExpiresAt: hoursFromNow(24).toISOString(),
          windowHadPassed: false,
        }),
      })
    );
  });

  it("extends a hold whose window has passed while its slot is still free", async () => {
    reads(booking());
    // A lapsed hold of someone else's on the same slot, and a booking on another slot: neither clashes.
    db.booking.findMany.mockResolvedValue([
      other({ id: "lapsed-hold", status: "HOLD", holdExpiresAt: hoursFromNow(-6) }),
      other({ id: "morning", timeSlot: "MORNING" }),
    ]);

    const res = await placeHold("booking-1", 4);

    expect(res.success).toBe(true);
    expect(db.booking.findMany.mock.calls[0][0].where).toMatchObject({
      id: { not: "booking-1" },
      venueId: "venue-1",
      status: { notIn: ["CANCELLED"] },
    });
    expect(db.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "extended_hold", changes: expect.objectContaining({ windowHadPassed: true }) })
    );
  });

  it.each([
    { label: "another booking on the same slot", rows: [other()] },
    { label: "a whole-day booking on the date", rows: [other({ timeSlot: "FULL_DAY" })] },
    { label: "another hold on the slot that still has money", rows: [other({ status: "HOLD", holdExpiresAt: hoursFromNow(-6), invoices: [{ status: "PARTIALLY_PAID", paidAmount: 5000, payments: [] }] })] },
  ])("won't give a lapsed hold its date back once $label holds it", async ({ rows }) => {
    reads(booking());
    db.booking.findMany.mockResolvedValue(rows);

    expect(await placeHold("booking-1", 24)).toEqual({ success: false, error: HOLD_SLOT_TAKEN_ERROR });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("a blackout on the date blocks it too", async () => {
    reads(booking());
    db.blackoutDate.findMany.mockResolvedValue([{ date: DAY, timeSlot: null }]);

    expect(await placeHold("booking-1", 24)).toEqual({ success: false, error: HOLD_SLOT_TAKEN_ERROR });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an extension that would end the hold sooner than it ends now", async () => {
    reads(booking({ holdExpiresAt: hoursFromNow(30) }));

    const res = await placeHold("booking-1", 24);

    expect(res).toEqual({ success: false, error: holdChangeError("NOT_LATER", hoursFromNow(30)) });
    expect(res.success === false && res.error).toMatch(/already runs until/);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to give a hold with no end time one", async () => {
    reads(booking({ holdExpiresAt: null }));

    expect(await placeHold("booking-1", 168)).toEqual({ success: false, error: holdChangeError("NO_END_TIME") });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("says so when the hold changed underneath: released, confirmed or extended meanwhile", async () => {
    reads(booking({ holdExpiresAt: hoursFromNow(2) }));
    db.booking.updateMany.mockResolvedValue({ count: 0 });

    expect(await placeHold("booking-1", 24)).toEqual({ success: false, error: HOLD_CHANGED_ERROR });
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("a serialization failure reads as a change, not a crash", async () => {
    reads(booking());
    db.$transaction.mockRejectedValueOnce(Object.assign(new Error("write conflict"), { code: "P2034" }));

    expect(await placeHold("booking-1", 24)).toEqual({ success: false, error: HOLD_CHANGED_ERROR });
  });
});

describe("placeHold: what the server checks again", () => {
  it.each([0, 169, 2.5, Number.NaN])("refuses %s hours before reading the booking", async (hours) => {
    expect(await placeHold("booking-1", hours)).toEqual({ success: false, error: holdChangeError("INVALID_HOURS") });
    expect(db.booking.findUnique).not.toHaveBeenCalled();
  });

  it.each(["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])("refuses a %s booking", async (status) => {
    reads(booking({ status }));

    expect(await placeHold("booking-1", 24)).toEqual({ success: false, error: holdChangeError("NOT_HOLDABLE") });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("needs bookings:update, as Place Hold always has", async () => {
    permissionMock.mockReturnValue(false);

    expect(await placeHold("booking-1", 24)).toEqual({ success: false, error: "Insufficient permissions" });
    expect(permissionMock).toHaveBeenCalledWith("SALES_EXEC", "bookings:update");
    expect(db.booking.findUnique).not.toHaveBeenCalled();
  });

  it("a booking that doesn't exist is not found", async () => {
    db.booking.findUnique.mockResolvedValueOnce(null);

    expect(await placeHold("missing", 24)).toEqual({ success: false, error: "Booking not found" });
  });
});
