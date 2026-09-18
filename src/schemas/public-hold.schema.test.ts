import { describe, expect, it } from "vitest";
import {
  MAX_PUBLIC_HOLDS_PER_CUSTOMER,
  PUBLIC_HOLD_CAP_MESSAGE,
  PUBLIC_HOLD_NAME_MAX,
  publicHoldCapError,
  publicHoldSchema,
} from "./public-hold.schema";

// ============================================================
// Public hold input limits: the customer-name cap (the name becomes part of
// the HOLD booking's event name) and the per-phone / per-email cap on new
// holds in 24 hours. Pure: no database.
// ============================================================

const valid = {
  venueId: "venue-1",
  dateISO: "2030-06-20",
  timeSlot: "EVENING" as const,
  guestCount: 200,
  customerName: "Asha Rao",
  customerPhone: "+91 98765 43210",
};

describe("publicHoldSchema — customer name", () => {
  it("accepts a name of up to 80 characters, counted after trimming", () => {
    expect(PUBLIC_HOLD_NAME_MAX).toBe(80);
    expect(publicHoldSchema.safeParse({ ...valid, customerName: "a".repeat(80) }).success).toBe(true);
    const padded = publicHoldSchema.safeParse({ ...valid, customerName: `   ${"a".repeat(80)}   ` });
    expect(padded.success && padded.data.customerName).toBe("a".repeat(80));
  });

  it("refuses a longer name with a message the customer can act on", () => {
    const r = publicHoldSchema.safeParse({ ...valid, customerName: "a".repeat(81) });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.customerName).toEqual(["Please keep your name to 80 characters or fewer."]);
    }
  });

  it("keeps the booking event name built from it bounded", () => {
    const data = publicHoldSchema.parse({ ...valid, eventType: "e".repeat(80), customerName: "n".repeat(80) });
    expect(`${data.eventType} — ${data.customerName.trim()}`.length).toBe(163);
    expect(publicHoldSchema.safeParse({ ...valid, eventType: "e".repeat(81) }).success).toBe(false);
  });

  it("still requires a real name", () => {
    expect(publicHoldSchema.safeParse({ ...valid, customerName: " a " }).success).toBe(false);
  });
});

describe("publicHoldCapError — new holds per phone number and per email in 24 hours", () => {
  it("allows up to 3 holds for a phone number and for an email", () => {
    expect(MAX_PUBLIC_HOLDS_PER_CUSTOMER).toBe(3);
    expect(publicHoldCapError({ byPhone: 0, byEmail: 0 })).toBeNull();
    expect(publicHoldCapError({ byPhone: 2, byEmail: 2 })).toBeNull();
  });

  it("refuses the next hold once either the phone number or the email has 3", () => {
    expect(publicHoldCapError({ byPhone: 3, byEmail: 0 })).toBe(PUBLIC_HOLD_CAP_MESSAGE);
    expect(publicHoldCapError({ byPhone: 0, byEmail: 3 })).toBe(PUBLIC_HOLD_CAP_MESSAGE);
    expect(publicHoldCapError({ byPhone: 7, byEmail: 9 })).toBe(PUBLIC_HOLD_CAP_MESSAGE);
  });

  it("tells the customer what happened and what to do next", () => {
    expect(PUBLIC_HOLD_CAP_MESSAGE).toContain("3 date holds in the last 24 hours");
    expect(PUBLIC_HOLD_CAP_MESSAGE).toContain("contact us");
  });
});
