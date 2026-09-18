import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// The public-hold expiry job judges each stale PublicHold by its team Booking
// and the ONE lapsed rule, and releases through releaseLapsedHold(): the
// booking cancel is guarded by that rule inside the UPDATE, and the PublicHold
// changes only after the cancel succeeds. It used to check the token invoice
// only, and could cancel a booking with money on another invoice.
// The database is stubbed; the holds modules are the real ones.
// ============================================================

const db = vi.hoisted(() => ({
  publicHoldFindMany: vi.fn(),
  publicHoldUpdateMany: vi.fn(),
  bookingFindMany: vi.fn(),
  bookingFindUnique: vi.fn(),
  bookingUpdateMany: vi.fn(),
  invoiceFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    publicHold: { findMany: db.publicHoldFindMany, updateMany: db.publicHoldUpdateMany },
    booking: { findMany: db.bookingFindMany, findUnique: db.bookingFindUnique, updateMany: db.bookingUpdateMany },
    invoice: { findFirst: db.invoiceFindFirst },
  },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}));

import { GET } from "./route";
import { lapsedHoldWhere, moneyInvoiceWhere } from "@/lib/holds/lapsed-hold";

const SECRET = "public-hold-expiry-test-secret";
const NOW = new Date("2026-09-16T10:00:00.000Z");
const PAST = new Date("2026-09-16T06:00:00.000Z");
const FUTURE = new Date("2026-09-17T06:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

const tokenUnpaid = { status: "SENT", paidAmount: 0, payments: [] };
const hold = { id: "h1", bookingId: "b1", invoiceId: "token-inv" };

type Res = { status: number; body: Record<string, unknown> };
async function run(authorization = `Bearer ${SECRET}`): Promise<Res> {
  const res = await GET(new Request("http://localhost/api/cron/public-hold-expiry", { headers: { authorization } }));
  return res as unknown as Res;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = SECRET;
  for (const fn of Object.values(db)) fn.mockReset();
  db.publicHoldFindMany.mockResolvedValue([hold]);
  db.publicHoldUpdateMany.mockResolvedValue({ count: 1 });
  db.bookingUpdateMany.mockResolvedValue({ count: 1 });
  db.invoiceFindFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("public-hold-expiry cron", () => {
  it("refuses a caller without the cron secret", async () => {
    const res = await run("Bearer nope");
    expect(res.status).toBe(401);
    expect(db.publicHoldFindMany).not.toHaveBeenCalled();
  });

  it("releases a lapsed hold through the guarded cancel, then expires its PublicHold", async () => {
    db.bookingFindMany.mockResolvedValueOnce([{ id: "b1", status: "HOLD", holdExpiresAt: PAST, invoices: [tokenUnpaid] }]);

    const res = await run();

    expect(db.bookingUpdateMany).toHaveBeenCalledWith({ where: { id: "b1", ...lapsedHoldWhere(NOW) }, data: { status: "CANCELLED" } });
    expect(db.publicHoldUpdateMany).toHaveBeenCalledTimes(1);
    expect(db.publicHoldUpdateMany).toHaveBeenCalledWith({
      where: { bookingId: { in: ["b1"] }, status: { in: ["INITIATED", "SLOT_CLAIMED"] }, paidAt: null },
      data: { status: "EXPIRED" },
    });
    // The PublicHold changes only after the booking cancel.
    expect(db.bookingUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(db.publicHoldUpdateMany.mock.invocationCallOrder[0]);
    expect(res.body).toMatchObject({ success: true, ranAt: NOW.toISOString(), scanned: 1, expired: 1, skippedPaid: 0, bookingsCancelled: 1 });
  });

  it("never cancels a booking with money on ANOTHER invoice while the token invoice is unpaid", async () => {
    db.bookingFindMany.mockResolvedValueOnce([
      { id: "b1", status: "HOLD", holdExpiresAt: PAST, invoices: [tokenUnpaid, { status: "PARTIALLY_PAID", paidAmount: 5000, payments: [] }] },
    ]);

    const res = await run();

    expect(db.bookingUpdateMany).not.toHaveBeenCalled();
    expect(db.publicHoldUpdateMany).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ expired: 0, skippedPaid: 1, bookingsCancelled: 0 });
  });

  it("a checkout in flight or a proof awaiting verification protects the hold", async () => {
    db.publicHoldFindMany.mockResolvedValueOnce([hold, { id: "h2", bookingId: "b2", invoiceId: "token-2" }]);
    db.bookingFindMany.mockResolvedValueOnce([
      {
        id: "b1",
        status: "HOLD",
        holdExpiresAt: PAST,
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(3) }] }],
      },
      {
        id: "b2",
        status: "HOLD",
        holdExpiresAt: PAST,
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: minutesAgo(300), createdAt: minutesAgo(300) }] }],
      },
    ]);

    const res = await run();

    expect(db.bookingUpdateMany).not.toHaveBeenCalled();
    expect(db.publicHoldUpdateMany).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ scanned: 2, expired: 0, skippedPaid: 2 });
  });

  it("a payment landing between the read and the cancel wins: re-judged, PublicHold untouched", async () => {
    db.bookingFindMany.mockResolvedValueOnce([{ id: "b1", status: "HOLD", holdExpiresAt: PAST, invoices: [tokenUnpaid] }]);
    db.bookingUpdateMany.mockResolvedValueOnce({ count: 0 });
    db.bookingFindUnique.mockResolvedValueOnce({
      id: "b1",
      status: "HOLD",
      holdExpiresAt: PAST,
      invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "COMPLETED", receiptUploadedAt: null, createdAt: NOW }] }],
    });

    const res = await run();

    expect(db.publicHoldUpdateMany).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ expired: 0, skippedPaid: 1, bookingsCancelled: 0 });
  });

  it("a booking already cancelled elsewhere with no money: only the hold row catches up", async () => {
    db.bookingFindMany.mockResolvedValueOnce([{ id: "b1", status: "CANCELLED", holdExpiresAt: PAST, invoices: [tokenUnpaid] }]);

    const res = await run();

    expect(db.bookingUpdateMany).not.toHaveBeenCalled();
    expect(db.publicHoldUpdateMany).toHaveBeenCalledWith({
      where: { id: "h1", status: { in: ["INITIATED", "SLOT_CLAIMED"] }, paidAt: null },
      data: { status: "EXPIRED" },
    });
    expect(res.body).toMatchObject({ expired: 1, bookingsCancelled: 0 });
  });

  it("follows the team's booking: an extended hold or a confirmed booking is left alone", async () => {
    db.publicHoldFindMany.mockResolvedValueOnce([hold, { id: "h2", bookingId: "b2", invoiceId: "token-2" }]);
    db.bookingFindMany.mockResolvedValueOnce([
      { id: "b1", status: "HOLD", holdExpiresAt: FUTURE, invoices: [tokenUnpaid] }, // team extended the hold
      { id: "b2", status: "CONFIRMED", holdExpiresAt: PAST, invoices: [tokenUnpaid] }, // confirmed on contract
    ]);

    const res = await run();

    expect(db.bookingUpdateMany).not.toHaveBeenCalled();
    expect(db.publicHoldUpdateMany).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ scanned: 2, expired: 0, skippedActive: 2, skippedPaid: 0 });
  });

  it("with no booking, the hold row expires unless its token invoice has money", async () => {
    db.publicHoldFindMany.mockResolvedValueOnce([
      { id: "orphan", bookingId: null, invoiceId: "inv-unpaid" },
      { id: "orphan-paid", bookingId: null, invoiceId: "inv-paid" },
    ]);
    db.invoiceFindFirst.mockImplementation(async (args: { where: { id: string } }) =>
      args.where.id === "inv-paid" ? { id: "inv-paid" } : null
    );

    const res = await run();

    expect(db.bookingFindMany).not.toHaveBeenCalled();
    expect(db.invoiceFindFirst).toHaveBeenCalledWith({ where: { id: "inv-paid", ...moneyInvoiceWhere(NOW) }, select: { id: true } });
    expect(db.publicHoldUpdateMany).toHaveBeenCalledTimes(1);
    expect(db.publicHoldUpdateMany.mock.calls[0][0].where.id).toBe("orphan");
    expect(res.body).toMatchObject({ scanned: 2, expired: 1, skippedPaid: 1 });
  });
});
