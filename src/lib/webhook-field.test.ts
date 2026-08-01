import { describe, it, expect } from "vitest";
import { fieldValue, firstUsable, usableValue, LEAD_VALUE_KEYS } from "./webhook-field";

// ============================================================
// These cases are the two real production bugs, pinned so neither can come
// back — they failed in OPPOSITE directions, so a fix for one must not
// reintroduce the other.
// ============================================================

describe("usableValue", () => {
  it("rejects the boolean Google sends for an unfilled column", () => {
    // This is the bug that put the text "false" in a customer's phone field.
    expect(usableValue(false)).toBeNull();
    expect(usableValue(true)).toBeNull();
  });

  it("accepts a phone delivered as an unquoted JSON number", () => {
    // This is the bug that came NEXT: hardening to strings-only silently
    // dropped a numeric phone, so it went from wrong to missing.
    expect(usableValue(9611360491)).toBe("9611360491");
    expect(usableValue(919611360491)).toBe("919611360491");
  });

  it("keeps ordinary strings, trimmed", () => {
    expect(usableValue("  +91 96113 60491 ")).toBe("+91 96113 60491");
    expect(usableValue("Priya Sharma")).toBe("Priya Sharma");
  });

  it("treats placeholder text as absent, whatever its case", () => {
    for (const v of ["false", "FALSE", "null", "N/A", "n/a", "-", "none", "  "]) {
      expect(usableValue(v)).toBeNull();
    }
  });

  it("rejects anything that isn't text or a whole number", () => {
    expect(usableValue(null)).toBeNull();
    expect(usableValue(undefined)).toBeNull();
    expect(usableValue({})).toBeNull();
    expect(usableValue([])).toBeNull();
    expect(usableValue(NaN)).toBeNull();
    expect(usableValue(Infinity)).toBeNull();
    // Beyond any real phone/ID, and String() would give "1e+21".
    // Number.isInteger(1e21) is TRUE, so the magnitude bound is what stops it.
    expect(usableValue(1e21)).toBeNull();
    expect(usableValue(1e16)).toBeNull();
    // The longest legal E.164 number (15 digits) must still get through.
    expect(usableValue(919611360491234)).toBe("919611360491234");
  });
});

describe("fieldValue — Google Ads columns", () => {
  it("reads the phone when string_value is false but a number is present", () => {
    // The exact shape that broke: `??` stopped at string_value because `false`
    // IS present, so the real value was never looked at.
    const col = { column_id: "PHONE_NUMBER", string_value: false, number_value: 9611360491 };
    expect(fieldValue(col, LEAD_VALUE_KEYS)).toBe("9611360491");
  });

  it("returns blank — not 'false' — when the column really is empty", () => {
    const col = { column_id: "PHONE_NUMBER", string_value: false };
    expect(fieldValue(col, LEAD_VALUE_KEYS)).toBe("");
  });

  it("handles the documented happy path and the camelCase variant", () => {
    expect(fieldValue({ string_value: "+919611360491" }, LEAD_VALUE_KEYS)).toBe("+919611360491");
    expect(fieldValue({ stringValue: "+919611360491" }, LEAD_VALUE_KEYS)).toBe("+919611360491");
    expect(fieldValue({ value: "+919611360491" }, LEAD_VALUE_KEYS)).toBe("+919611360491");
  });

  it("is safe on a missing or non-object column", () => {
    expect(fieldValue(null, LEAD_VALUE_KEYS)).toBe("");
    expect(fieldValue(undefined, LEAD_VALUE_KEYS)).toBe("");
    expect(fieldValue({}, LEAD_VALUE_KEYS)).toBe("");
  });
});

describe("firstUsable — Facebook values arrays", () => {
  it("takes the first real entry", () => {
    expect(firstUsable(["+919611360491"])).toBe("+919611360491");
    expect(firstUsable([null, "", "priya@example.com"])).toBe("priya@example.com");
  });

  it("returns blank for an unfilled field", () => {
    expect(firstUsable([])).toBe("");
    expect(firstUsable([null])).toBe("");
    expect(firstUsable([false])).toBe("");
    expect(firstUsable(undefined)).toBe("");
  });

  it("accepts a numeric phone from the Graph API", () => {
    expect(firstUsable([9611360491])).toBe("9611360491");
  });
});
