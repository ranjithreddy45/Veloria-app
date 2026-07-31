import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/sales/lead-import";
import { phoneDigits } from "@/lib/dedup";

// ============================================================
// Regression: the Google Ads webhook stored the literal text "false" as a
// customer's phone number.
//
// Chain of causes:
//   1. `user_column_data` was cast to Record<string, string> — a lie about
//      untrusted input.
//   2. Google sent `string_value: false` for an unfilled column.
//   3. `col.string_value ?? ""` does NOT skip `false` (?? only skips
//      null/undefined), so String(false) === "false".
//   4. "false" is truthy, so the `if (!value) continue` guard passed it.
//   5. captureLeadFromExternal wrote it straight to Contact.phone.
//
// These tests pin the two defences: only real strings survive extraction, and
// nothing that isn't phone-shaped reaches the CRM.
// ============================================================

/** The webhook's extraction, as hardened. */
function extractPhone(cols: Array<Record<string, unknown>>): string {
  let phone = "";
  for (const col of cols) {
    const columnId = String(col.column_id ?? "").toUpperCase();
    const raw = col.string_value ?? col.stringValue;
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) continue;
    if (columnId.includes("PHONE")) phone = value;
  }
  return phone;
}

describe("Google Ads phone extraction", () => {
  it("never turns a non-string into a phone (the reported bug)", () => {
    for (const bad of [false, true, null, undefined, 0, 919611360491, {}, []]) {
      expect(extractPhone([{ column_id: "PHONE_NUMBER", string_value: bad }])).toBe("");
    }
  });

  it("still accepts a real phone string", () => {
    expect(extractPhone([{ column_id: "PHONE_NUMBER", string_value: "+91 96113 60491" }]))
      .toBe("+91 96113 60491");
  });
});

describe("phone reaching the CRM", () => {
  it("rejects junk that would otherwise look like a real number in the UI", () => {
    for (const junk of ["false", "true", "null", "undefined", "N/A", "-", "abc", ""]) {
      expect(normalizePhone(junk)).toBeNull();
    }
  });

  it("accepts the +91 shapes Google and manual entry actually send", () => {
    for (const good of ["9611360491", "+919611360491", "+91 96113 60491", "+91-96113-60491", "09611360491"]) {
      expect(normalizePhone(good)).not.toBeNull();
    }
  });

  it("matches every +91 variant to ONE person, so an ad lead can't duplicate a contact", () => {
    // phoneDigits is the dedupe key: last 10 digits, ignoring +91 / 0 / spaces.
    const variants = ["9611360491", "+919611360491", "+91 96113 60491", "+91-96113-60491", "09611360491", "91 9611360491"];
    const keys = new Set(variants.map((v) => phoneDigits(v)));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe("9611360491");
  });

  it("keeps different people apart", () => {
    expect(phoneDigits("+919611360491")).not.toBe(phoneDigits("+919611360492"));
  });
});
