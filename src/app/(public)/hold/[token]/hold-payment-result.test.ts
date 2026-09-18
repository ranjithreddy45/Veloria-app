import { describe, it, expect } from "vitest";
import { CANCELLED_BOOKING_TITLE, cancelledBookingNotice } from "@/app/pay/[token]/outcome-state";
import { holdPaymentCopy, type HoldPaymentState } from "./hold-payment-result";

// ============================================================
// After a payment the /hold page says what the records say, with the /pay
// result's outcome state: "your date is secured" only for a live booking. A
// payment on a cancelled booking is told the booking isn't active, and that the
// team knows only when the team's alert is on record.
// ============================================================

const amount = "₹5,000";
const words = (state: HoldPaymentState, teamAlerted = false) => {
  const c = holdPaymentCopy(state, { amount, teamAlerted });
  return [c.heading, c.title, ...c.lines].join(" ");
};

describe("holdPaymentCopy", () => {
  it("a live booking is told its date is secured and blocked", () => {
    const copy = holdPaymentCopy("LIVE", { amount, teamAlerted: false });
    expect(copy).toMatchObject({ tone: "success", heading: "Your date is secured", contactFirst: false });
    expect(copy.title).toMatch(/secured/);
    expect(copy.lines[0]).toBe("Payment of ₹5,000 received — this date is now blocked for you.");
  });

  it.each(["CANCELLED", "INACTIVE", "CHECKING", "UNKNOWN"] as const)(
    "%s never says the date is secured, blocked or confirmed",
    (state) => {
      for (const teamAlerted of [true, false]) {
        expect(words(state, teamAlerted)).not.toMatch(/secured|blocked for you|confirmed/i);
        expect(holdPaymentCopy(state, { amount, teamAlerted }).heading).toBe("Payment received");
      }
    }
  );

  it("a cancelled booking gets the /pay result's title and notice, contact buttons first", () => {
    expect(holdPaymentCopy("CANCELLED", { amount, teamAlerted: true })).toEqual({
      tone: "warn",
      heading: "Payment received",
      title: CANCELLED_BOOKING_TITLE,
      lines: [cancelledBookingNotice(true)],
      contactFirst: true,
    });
    expect(holdPaymentCopy("CANCELLED", { amount, teamAlerted: false }).lines).toEqual([cancelledBookingNotice(false)]);
  });

  it("says the team was told only when the team's alert is on record", () => {
    expect(words("CANCELLED", true)).toMatch(/told our team/i);
    expect(words("CANCELLED", false)).not.toMatch(/told our team/i);
    expect(words("LIVE", true)).not.toMatch(/told our team/i);
  });

  it("while the outcome loads it acknowledges the payment and nothing more", () => {
    const text = holdPaymentCopy("CHECKING", { amount, teamAlerted: false }).lines.join(" ");
    expect(text).toMatch(/₹5,000 received/);
    expect(text).toMatch(/checking your booking/i);
  });

  it("an outcome that can't be read, or a completed event, points the customer to us", () => {
    expect(holdPaymentCopy("UNKNOWN", { amount, teamAlerted: false }).contactFirst).toBe(true);
    expect(words("UNKNOWN")).toMatch(/couldn't load/i);
    expect(holdPaymentCopy("INACTIVE", { amount, teamAlerted: false }).contactFirst).toBe(true);
    expect(words("INACTIVE")).toMatch(/received and recorded/i);
  });
});
