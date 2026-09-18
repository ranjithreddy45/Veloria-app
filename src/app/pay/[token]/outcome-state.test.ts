import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CANCELLED_BOOKING_TITLE, cancelledBookingNotice, outcomeBookingState } from "./outcome-state";
import type { HoldFacts, HoldInvoiceFacts } from "@/lib/holds/lapsed-hold";

// ============================================================
// The /pay outcome offers "Open your event in the app" only for a live
// booking. A payment that lands on a cancelled booking is told the booking
// isn't active, and that the team knows only when the team's alert is on record.
// ============================================================

const NOW = new Date("2026-09-16T10:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000);

const unpaid: HoldInvoiceFacts = { status: "SENT", paidAmount: 0, payments: [] };
const justPaid: HoldInvoiceFacts = { status: "PARTIALLY_PAID", paidAmount: 5000, payments: [{ status: "COMPLETED", createdAt: NOW }] };
const booking = (status: string, over: Partial<HoldFacts> = {}): HoldFacts => ({
  status,
  holdExpiresAt: null,
  invoices: [justPaid],
  ...over,
});

describe("outcomeBookingState", () => {
  it.each(["TENTATIVE", "CONFIRMED", "IN_PROGRESS"])("a %s booking is live", (status) => {
    expect(outcomeBookingState(booking(status), NOW)).toBe("LIVE");
  });

  it("a HOLD with the payment just made against it is live, even past its window", () => {
    expect(outcomeBookingState(booking("HOLD", { holdExpiresAt: hoursAgo(1) }), NOW)).toBe("LIVE");
  });

  it("a HOLD with a payment proof awaiting verification is live", () => {
    const proof: HoldInvoiceFacts = { status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: hoursAgo(3), createdAt: hoursAgo(3) }] };
    expect(outcomeBookingState(booking("HOLD", { holdExpiresAt: hoursAgo(1), invoices: [proof] }), NOW)).toBe("LIVE");
  });

  it("a HOLD with nothing against it is not live", () => {
    expect(outcomeBookingState(booking("HOLD", { holdExpiresAt: hoursAhead(3), invoices: [unpaid] }), NOW)).toBe("INACTIVE");
    expect(outcomeBookingState(booking("HOLD", { holdExpiresAt: hoursAgo(3), invoices: [unpaid] }), NOW)).toBe("INACTIVE");
  });

  it("a cancelled booking is CANCELLED, with money against it or not", () => {
    expect(outcomeBookingState(booking("CANCELLED"), NOW)).toBe("CANCELLED");
    expect(outcomeBookingState(booking("CANCELLED", { invoices: [unpaid] }), NOW)).toBe("CANCELLED");
  });

  it("a completed event is not live", () => {
    expect(outcomeBookingState(booking("COMPLETED"), NOW)).toBe("INACTIVE");
  });

  it("classifies every BookingStatus in the schema: only TENTATIVE, CONFIRMED and IN_PROGRESS are live on status alone", () => {
    const schema = readFileSync(fileURLToPath(new URL("../../../../prisma/schema.prisma", import.meta.url)), "utf8");
    const values = (/enum BookingStatus \{([^}]*)\}/.exec(schema)?.[1] ?? "").split(/\s+/).filter(Boolean);
    expect(values).toContain("CANCELLED");
    const liveOnStatus = values.filter((s) => outcomeBookingState(booking(s, { invoices: [unpaid] }), NOW) === "LIVE");
    expect([...liveOnStatus].sort()).toEqual(["CONFIRMED", "IN_PROGRESS", "TENTATIVE"]);
  });
});

describe("the cancelled-booking notice", () => {
  it("says the payment is recorded and the booking is cancelled, and never points to the event", () => {
    for (const text of [cancelledBookingNotice(true), cancelledBookingNotice(false)]) {
      expect(text).toMatch(/payment is received and recorded/i);
      expect(text).toMatch(/cancelled/i);
      expect(text).toMatch(/no longer reserved/i);
      expect(text).toMatch(/contact us/i);
      expect(text).not.toMatch(/open your event|secured|confirmed/i);
    }
    expect(CANCELLED_BOOKING_TITLE).toBe("This booking isn't active");
  });

  it("says the team was told only when the team's alert is on record", () => {
    expect(cancelledBookingNotice(true)).toMatch(/told our team/i);
    expect(cancelledBookingNotice(false)).not.toMatch(/team/i);
  });
});
