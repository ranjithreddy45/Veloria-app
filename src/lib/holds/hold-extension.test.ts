import { describe, it, expect } from "vitest";
import {
  EXTEND_HOLD_LABEL,
  EXTEND_HOLD_PRESET_HOURS,
  HOLD_CHANGED_ERROR,
  HOLD_HOURS_MAX,
  HOLD_HOURS_MIN,
  HOLD_SLOT_TAKEN_ERROR,
  holdChangeError,
  holdChangeRefusal,
  holdExpiryAfter,
  isValidHoldHours,
  type HoldChangeRefusal,
} from "./hold-extension";

// ============================================================
// Place Hold and Extend hold set a hold to end a whole number of hours from
// now, 1 to 168. An extension must end the hold later than it ends now, and a
// hold with no end time is never given one (that would shorten it).
// ============================================================

const NOW = new Date("2026-09-16T10:00:00.000Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000);

describe("hold hours", () => {
  it("are whole hours from 1 to 168 (seven days)", () => {
    expect(HOLD_HOURS_MIN).toBe(1);
    expect(HOLD_HOURS_MAX).toBe(168);
    for (const h of [1, 4, 24, 167, 168]) expect(isValidHoldHours(h)).toBe(true);
    for (const h of [0, -1, 169, 2.5, Number.NaN, Number.POSITIVE_INFINITY, "24", null, undefined]) {
      expect(isValidHoldHours(h)).toBe(false);
    }
  });

  it("every quick pick in the dialog is allowed", () => {
    for (const h of EXTEND_HOLD_PRESET_HOURS) expect(isValidHoldHours(h)).toBe(true);
  });

  it("a hold set now ends exactly that many hours later", () => {
    expect(holdExpiryAfter(24, NOW).toISOString()).toBe("2026-09-17T10:00:00.000Z");
    expect(holdExpiryAfter(168, NOW).toISOString()).toBe("2026-09-23T10:00:00.000Z");
  });
});

describe("holdChangeRefusal", () => {
  it("places a tentative booking on hold", () => {
    expect(holdChangeRefusal({ status: "TENTATIVE", holdExpiresAt: null }, 48, NOW)).toBeNull();
  });

  it("extends a hold whose window has passed", () => {
    expect(holdChangeRefusal({ status: "HOLD", holdExpiresAt: hoursFromNow(-3) }, 4, NOW)).toBeNull();
  });

  it("extends a hold inside its window when the new end is later", () => {
    expect(holdChangeRefusal({ status: "HOLD", holdExpiresAt: hoursFromNow(10) }, 24, NOW)).toBeNull();
  });

  it("refuses an extension that would end the hold sooner, or at the same moment", () => {
    expect(holdChangeRefusal({ status: "HOLD", holdExpiresAt: hoursFromNow(30) }, 24, NOW)).toBe("NOT_LATER");
    expect(holdChangeRefusal({ status: "HOLD", holdExpiresAt: hoursFromNow(24) }, 24, NOW)).toBe("NOT_LATER");
  });

  it("reads an end time sent as a string", () => {
    expect(holdChangeRefusal({ status: "HOLD", holdExpiresAt: hoursFromNow(30).toISOString() }, 24, NOW)).toBe("NOT_LATER");
    expect(holdChangeRefusal({ status: "HOLD", holdExpiresAt: hoursFromNow(-1).toISOString() }, 24, NOW)).toBeNull();
  });

  it("refuses to give a hold with no end time one, since that would shorten it", () => {
    expect(holdChangeRefusal({ status: "HOLD", holdExpiresAt: null }, 168, NOW)).toBe("NO_END_TIME");
  });

  it.each(["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])("refuses a %s booking", (status) => {
    expect(holdChangeRefusal({ status, holdExpiresAt: hoursFromNow(-1) }, 24, NOW)).toBe("NOT_HOLDABLE");
  });

  it("checks the hours before anything else", () => {
    expect(holdChangeRefusal({ status: "HOLD", holdExpiresAt: null }, 0, NOW)).toBe("INVALID_HOURS");
    expect(holdChangeRefusal({ status: "CONFIRMED", holdExpiresAt: null }, 500, NOW)).toBe("INVALID_HOURS");
  });
});

describe("the words", () => {
  it("the menu item is Extend hold", () => {
    expect(EXTEND_HOLD_LABEL).toBe("Extend hold");
  });

  it("an extension that ends too soon names the current end, in India time", () => {
    // 10:10 UTC is 3:40 pm in India.
    expect(holdChangeError("NOT_LATER", new Date("2026-09-17T10:10:00.000Z"))).toMatch(/already runs until 17 Sept?,?\s3:40\spm IST/i);
  });

  it("every refusal says something, and the hours refusal gives the limits", () => {
    const all: HoldChangeRefusal[] = ["INVALID_HOURS", "NOT_HOLDABLE", "NO_END_TIME", "NOT_LATER"];
    for (const r of all) expect(holdChangeError(r, hoursFromNow(30)).length).toBeGreaterThan(10);
    expect(holdChangeError("INVALID_HOURS")).toMatch(/1 to 168 hours/);
    expect(HOLD_SLOT_TAKEN_ERROR).toMatch(/no longer free/);
    expect(HOLD_CHANGED_ERROR).toMatch(/refresh/i);
  });
});
