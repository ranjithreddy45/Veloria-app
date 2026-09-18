import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// The team's booking engine applies the ONE lapsed-hold decision
// (src/lib/holds/lapsed-hold.ts), so a slot the availability board and the
// customer's calendar show as free is bookable here too:
//  - checkAvailability ignores lapsed holds (read-only);
//  - createBooking / updateBooking release lapsed holds on the target slot
//    first, then their clash checks judge holds by the shared rule;
//  - a hold with money, or a failed release, still refuses the slot.
// Prisma and the framework are stubbed. The lapsed-hold modules are real,
// except releaseLapsedHoldsForSlot, whose own tests live next to it.
// ============================================================

const { db, authMock, releaseForSlot } = vi.hoisted(() => {
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
    db: { booking: table(), blackoutDate: table(), contact: table(), venue: table(), beo: table(), $transaction: vi.fn() },
    authMock: vi.fn(),
    releaseForSlot: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => undefined) }));
vi.mock("@/lib/sms", () => ({ sendSMSFireAndForget: vi.fn() }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn(async () => undefined) }));
vi.mock("@/lib/email-templates/booking-confirmation", () => ({ bookingConfirmationEmail: vi.fn(() => "") }));
vi.mock("@/lib/workflow-executor", () => ({ triggerWorkflows: vi.fn() }));
vi.mock("@/lib/approval-engine", () => ({ requestApprovalIfNeeded: vi.fn() }));
vi.mock("@/lib/velos/award", () => ({ awardVelos: vi.fn() }));
vi.mock("@/lib/sales/booking-confirmation-artifacts", () => ({ initBookingConfirmationArtifacts: vi.fn() }));
vi.mock("@/lib/holds/release-lapsed-holds", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  releaseLapsedHoldsForSlot: releaseForSlot,
}));

import { notify } from "@/lib/notify";
import { checkAvailability, completeBooking, confirmBooking, createBooking, getBookingsForCalendar, updateBooking } from "./booking.actions";

const PAST = new Date(Date.now() - 6 * 60 * 60 * 1000); // hold window passed
const DAY = new Date("2027-01-20T00:00:00.000Z");
const unpaid = { status: "SENT", paidAmount: 0, payments: [] };
const partPaid = { status: "PARTIALLY_PAID", paidAmount: 20000, payments: [] };

// The same two expired holds, as rows of each query shape.
const lapsedListRow = {
  id: "hold-lapsed",
  bookingNumber: "VG-2026-0101",
  eventName: "Unpaid hold",
  timeSlot: "EVENING",
  date: DAY,
  status: "HOLD",
  holdExpiresAt: PAST,
};
const paidListRow = { ...lapsedListRow, id: "hold-paid", bookingNumber: "VG-2026-0102", eventName: "Part-paid hold" };
const lapsedFacts = { id: "hold-lapsed", status: "HOLD", holdExpiresAt: PAST, date: DAY, invoices: [unpaid] };
const paidFacts = { id: "hold-paid", status: "HOLD", holdExpiresAt: PAST, date: DAY, invoices: [unpaid, partPaid] };

type Row = Record<string, unknown>;
type FindManyArgs = { where: Record<string, unknown>; select: Record<string, unknown> };

/** Answer booking.findMany by query shape: the lapsed-facts lookup, a slot/calendar list, or a clash check. */
function bookingRows(rows: { list?: Row[]; facts?: Row[]; clashes?: Row[] }) {
  db.booking.findMany.mockImplementation(async (args: FindManyArgs) => {
    const ids = (args.where.id as { in?: string[] } | undefined)?.in;
    if (ids) return (rows.facts ?? []).filter((r) => ids.includes(r.id as string));
    if (args.select.bookingNumber) return rows.list ?? [];
    return rows.clashes ?? [];
  });
}

const input = {
  eventName: "Reception — Asha",
  eventType: "Reception",
  venueId: "venue-1",
  contactId: "contact-1",
  date: DAY,
  timeSlot: "EVENING" as const,
  guestCount: 200,
  totalAmount: 250000,
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  db.blackoutDate.findMany.mockResolvedValue([]);
  db.booking.findFirst.mockResolvedValue(null); // booking-number allocation
  db.booking.count.mockResolvedValue(0);
  db.contact.findUnique.mockResolvedValue(null); // no customer email to send
  db.booking.create.mockResolvedValue({
    id: "booking-new",
    bookingNumber: "VG-2027-0001",
    status: "HOLD",
    contactId: "contact-1",
    contact: { id: "contact-1", firstName: "Asha", lastName: "Rao" },
    venue: { id: "venue-1", name: "Grand Hall" },
  });
  db.booking.update.mockResolvedValue({ id: "booking-1" });
  releaseForSlot.mockResolvedValue(0);
  bookingRows({});
});

describe("checkAvailability", () => {
  it("a lapsed hold does not make the slot unavailable, and nothing is released by a read", async () => {
    bookingRows({ list: [lapsedListRow], facts: [lapsedFacts] });

    const res = await checkAvailability("venue-1", DAY, "EVENING");

    expect(res).toEqual({ success: true, data: { available: true, reason: null } });
    expect(releaseForSlot).not.toHaveBeenCalled();
  });

  it("an expired hold with money still takes the slot", async () => {
    bookingRows({ list: [paidListRow], facts: [paidFacts] });

    const res = await checkAvailability("venue-1", DAY, "EVENING");

    expect(res).toEqual({ success: true, data: { available: false, reason: "Slot taken by VG-2026-0102 - Part-paid hold" } });
  });

  it("a lapsed hold never hides a real booking on the same slot", async () => {
    bookingRows({ list: [lapsedListRow, paidListRow], facts: [lapsedFacts, paidFacts] });

    const res = await checkAvailability("venue-1", DAY, "EVENING");

    expect(res.success && res.data.available).toBe(false);
  });

  it("blackouts still win", async () => {
    bookingRows({ list: [lapsedListRow], facts: [lapsedFacts] });
    db.blackoutDate.findMany.mockResolvedValue([{ date: DAY, reason: "Maintenance" }]);

    const res = await checkAvailability("venue-1", DAY, "EVENING");

    expect(res).toEqual({ success: true, data: { available: false, reason: "Venue is blacked out: Maintenance" } });
  });
});

describe("createBooking", () => {
  it("releases lapsed holds on the slot before the clash-guarded transaction, then books it", async () => {
    // The pre-check reads the lapsed hold as free; once released, the transaction sees no clash.
    bookingRows({ list: [lapsedListRow], facts: [lapsedFacts], clashes: [] });
    releaseForSlot.mockResolvedValue(1);

    const res = await createBooking(input);

    expect(res.success).toBe(true);
    expect(releaseForSlot).toHaveBeenCalledWith("venue-1", DAY, "EVENING", expect.any(Date));
    expect(releaseForSlot.mock.invocationCallOrder[0]).toBeLessThan(db.$transaction.mock.invocationCallOrder[0]);
    expect(db.booking.create).toHaveBeenCalledTimes(1);
  });

  it("the transaction's clash check reads hold facts and ignores a lapsed hold", async () => {
    // e.g. an EVENING hold that lapsed, against a FULL_DAY request
    bookingRows({ clashes: [lapsedFacts] });

    const res = await createBooking({ ...input, timeSlot: "FULL_DAY" });

    expect(res.success).toBe(true);
    const clashQuery = db.booking.findMany.mock.calls.at(-1)?.[0] as FindManyArgs;
    expect(clashQuery.where).toMatchObject({ venueId: "venue-1", status: { notIn: ["CANCELLED"] } });
    expect(clashQuery.select).toMatchObject({ status: true, holdExpiresAt: true, date: true });
    expect(clashQuery.select.invoices).toBeDefined();
  });

  it("a hold that gained money is kept: the transaction refuses the slot", async () => {
    bookingRows({ clashes: [paidFacts] });

    const res = await createBooking(input);

    expect(res).toEqual({ success: false, error: "That slot was just taken — please pick another." });
    expect(db.booking.create).not.toHaveBeenCalled();
  });

  it("a confirmed booking on the slot is still a clash", async () => {
    bookingRows({ clashes: [{ id: "confirmed", status: "CONFIRMED", holdExpiresAt: null, date: DAY, invoices: [] }] });

    const res = await createBooking(input);

    expect(res.success).toBe(false);
    expect(db.booking.create).not.toHaveBeenCalled();
  });

  it("if the release fails, the booking fails instead of booking around a hold that may be live", async () => {
    releaseForSlot.mockRejectedValueOnce(new Error("connection lost"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await createBooking(input);

    spy.mockRestore();
    expect(res).toEqual({ success: false, error: "Failed to create booking" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("updateBooking", () => {
  const existing = {
    id: "booking-1",
    status: "HOLD",
    date: new Date("2027-01-19T00:00:00.000Z"),
    venueId: "venue-1",
    timeSlot: "MORNING",
  };

  it("a move releases lapsed holds on the target slot (never the booking itself) and ignores them in the conflict check", async () => {
    db.booking.findUnique.mockResolvedValue(existing);
    bookingRows({ clashes: [lapsedFacts] });

    const res = await updateBooking("booking-1", input);

    expect(res.success).toBe(true);
    expect(releaseForSlot).toHaveBeenCalledWith("venue-1", DAY, "EVENING", expect.any(Date), "booking-1");
    expect(releaseForSlot.mock.invocationCallOrder[0]).toBeLessThan(db.booking.findMany.mock.invocationCallOrder[0]);
    expect(db.booking.update).toHaveBeenCalledTimes(1);
  });

  it("a hold with money on the target slot still blocks the move", async () => {
    db.booking.findUnique.mockResolvedValue(existing);
    bookingRows({ clashes: [paidFacts] });

    const res = await updateBooking("booking-1", input);

    expect(res).toEqual({ success: false, error: "The selected venue, date, and time slot is no longer available" });
    expect(db.booking.update).not.toHaveBeenCalled();
  });

  it("an edit that keeps venue, date and slot neither releases nor re-checks", async () => {
    db.booking.findUnique.mockResolvedValue({ ...existing, date: DAY, timeSlot: "EVENING" });

    const res = await updateBooking("booking-1", input);

    expect(res.success).toBe(true);
    expect(releaseForSlot).not.toHaveBeenCalled();
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });
});

describe("getBookingsForCalendar", () => {
  it("a lapsed hold stops occupying the calendar and is listed separately", async () => {
    bookingRows({ list: [lapsedListRow, paidListRow], facts: [lapsedFacts, paidFacts] });

    const res = await getBookingsForCalendar(1, 2027);

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.map((b) => b.id)).toEqual(["hold-paid"]);
    expect(res.lapsedHolds.map((b) => b.id)).toEqual(["hold-lapsed"]);
  });
});

// Completion's final-payment check is finance's owed rule (bookingBalance over
// the booking's invoices), the balance the booking page and the customer app show.
describe("completeBooking", () => {
  const pastEvent = (invoices: { status: string; balanceDue: number }[]) => ({
    id: "booking-1",
    status: "IN_PROGRESS",
    bookingNumber: "VG-2026-0200",
    eventName: "Reception — Asha",
    guestCount: 200,
    date: new Date("2026-01-10T00:00:00.000Z"),
    createdById: null,
    invoices,
    tasks: [],
  });

  beforeEach(() => {
    db.beo.findFirst.mockResolvedValue({ status: "PUBLISHED" });
    db.booking.updateMany.mockResolvedValue({ count: 1 });
  });

  it("an unsent draft or a fully refunded invoice does not hold up completion", async () => {
    db.booking.findUnique.mockResolvedValue(
      pastEvent([
        { status: "PAID", balanceDue: 0 },
        { status: "DRAFT", balanceDue: 50000 },
        { status: "REFUNDED", balanceDue: 100000 },
      ])
    );

    const res = await completeBooking("booking-1");

    expect(res).toEqual({ success: true, defectFree: true, pointsAwarded: 0 });
    expect(db.booking.findUnique.mock.calls[0][0].select.invoices).toEqual({ select: { status: true, balanceDue: true } });
    expect(db.booking.updateMany).toHaveBeenCalledTimes(1);
  });

  it("a balance still owed blocks completion", async () => {
    db.booking.findUnique.mockResolvedValue(pastEvent([{ status: "PARTIALLY_PAID", balanceDue: 20000 }]));

    const res = await completeBooking("booking-1");

    expect(res).toEqual({ success: false, gate: ["Final payment not cleared (balance still due)"] });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });
});

describe("confirmBooking", () => {
  it("names the slot with the shared slot label", async () => {
    db.booking.findUnique.mockResolvedValue({
      id: "booking-1",
      status: "HOLD",
      bookingNumber: "VG-2026-0201",
      eventName: "Reception — Asha",
      date: DAY,
      timeSlot: "EVENING",
      createdById: "user-1",
      contact: { firstName: "Asha", lastName: "Rao", email: null, phone: null },
      venue: { name: "Grand Hall" },
      createdBy: null,
    });
    db.booking.updateMany.mockResolvedValue({ count: 1 });

    const res = await confirmBooking("booking-1");

    expect(res).toEqual({ success: true, data: { id: "booking-1" } });
    expect(vi.mocked(notify)).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Evening (5pm–10pm)") })
    );
  });
});
