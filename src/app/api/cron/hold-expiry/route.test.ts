import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// The daily hold-expiry job releases holds through the ONE lapsed rule
// (src/lib/holds/lapsed-hold.ts): a checkout in flight or a payment proof
// awaiting verification protects a hold exactly as money on an invoice does.
// The database is stubbed; the release module is the real one.
// ============================================================

const db = vi.hoisted(() => ({
  bookingFindMany: vi.fn(),
  bookingCount: vi.fn(),
  bookingUpdateMany: vi.fn(),
  publicHoldFindMany: vi.fn(),
  publicHoldUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findMany: db.bookingFindMany, count: db.bookingCount, updateMany: db.bookingUpdateMany },
    publicHold: { findMany: db.publicHoldFindMany, updateMany: db.publicHoldUpdateMany },
  },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}));

import { GET } from "./route";
import { lapsedHoldWhere, moneyInvoiceWhere } from "@/lib/holds/lapsed-hold";

const SECRET = "hold-expiry-test-secret";
const NOW = new Date("2026-09-16T10:00:00.000Z");
const PAST = new Date("2026-09-15T10:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);
const unpaid = { status: "SENT", paidAmount: 0, payments: [] };

type Res = { status: number; body: Record<string, unknown> };
async function run(authorization = `Bearer ${SECRET}`): Promise<Res> {
  const res = await GET(new Request("http://localhost/api/cron/hold-expiry", { headers: { authorization } }));
  return res as unknown as Res;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = SECRET;
  for (const fn of Object.values(db)) fn.mockReset();
  db.bookingCount.mockResolvedValue(0);
  db.bookingUpdateMany.mockResolvedValue({ count: 1 });
  db.publicHoldFindMany.mockResolvedValue([]);
  db.publicHoldUpdateMany.mockImplementation(async (args: { where: { bookingId: { in: string[] } } }) => ({
    count: args.where.bookingId.in.length,
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("hold-expiry cron", () => {
  it("refuses a caller without the cron secret", async () => {
    const res = await run("Bearer nope");
    expect(res.status).toBe(401);
    expect(db.bookingFindMany).not.toHaveBeenCalled();
  });

  it("selects with lapsedHoldWhere(now), cancels through the guarded UPDATE and expires the PublicHold", async () => {
    db.bookingFindMany.mockResolvedValueOnce([{ id: "b1", status: "HOLD", holdExpiresAt: PAST, invoices: [unpaid] }]);

    const res = await run();

    expect(res.status).toBe(200);
    expect(db.bookingFindMany.mock.calls[0][0].where).toEqual(lapsedHoldWhere(NOW));
    expect(db.bookingUpdateMany).toHaveBeenCalledWith({
      where: { id: "b1", ...lapsedHoldWhere(NOW) },
      data: { status: "CANCELLED" },
    });
    expect(db.publicHoldUpdateMany).toHaveBeenCalledWith({
      where: { bookingId: { in: ["b1"] }, status: { in: ["INITIATED", "SLOT_CLAIMED"] }, paidAt: null },
      data: { status: "EXPIRED" },
    });
    expect(res.body).toMatchObject({ success: true, ranAt: NOW.toISOString(), expiredHolds: 1, skippedPaid: 0 });
  });

  it("never cancels a hold whose customer is mid-checkout or has uploaded a payment proof", async () => {
    // Even if the query were to return them, the pure re-check keeps both.
    db.bookingFindMany.mockResolvedValueOnce([
      {
        id: "checkout",
        status: "HOLD",
        holdExpiresAt: PAST,
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(2) }] }],
      },
      {
        id: "proof",
        status: "HOLD",
        holdExpiresAt: PAST,
        invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: minutesAgo(600), createdAt: minutesAgo(600) }] }],
      },
      { id: "second-invoice", status: "HOLD", holdExpiresAt: PAST, invoices: [unpaid, { status: "SENT", paidAmount: 500, payments: [] }] },
    ]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await run();

    spy.mockRestore();
    expect(db.bookingUpdateMany).not.toHaveBeenCalled();
    expect(db.publicHoldUpdateMany).not.toHaveBeenCalled();
    expect(res.body.expiredHolds).toBe(0);
  });

  it("a payment landing between the read and the cancel wins: nothing cancelled, PublicHold untouched", async () => {
    db.bookingFindMany.mockResolvedValueOnce([{ id: "race", status: "HOLD", holdExpiresAt: PAST, invoices: [unpaid] }]);
    db.bookingUpdateMany.mockResolvedValueOnce({ count: 0 });

    const res = await run();

    expect(res.body.expiredHolds).toBe(0);
    expect(db.publicHoldUpdateMany).not.toHaveBeenCalled();
  });

  it("reports expired holds kept because money has arrived or may be arriving (full money rule)", async () => {
    db.bookingFindMany.mockResolvedValueOnce([]);
    db.bookingCount.mockResolvedValueOnce(3);

    const res = await run();

    expect(db.bookingCount).toHaveBeenCalledWith({
      where: { status: "HOLD", holdExpiresAt: { not: null, lt: NOW }, invoices: { some: moneyInvoiceWhere(NOW) } },
    });
    expect(res.body).toMatchObject({ success: true, expiredHolds: 0, skippedPaid: 3 });
  });
});
