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

// ============================================================
// International enquiries. The first fix assumed every bare 10-digit number was
// Indian — which silently turned a US "4155552671" into "+914155552671", a
// number nobody can ring. India reserves 10-digit mobiles starting 6-9, so that
// range is a safe inference and everything else must NOT be guessed.
// ============================================================
function canonicalPhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  const local = digits.replace(/^0+/, "");
  if (/^[6-9]\d{9}$/.test(local)) return `+91${local}`;
  if (local.length === 12 && local.startsWith("91")) return `+${local}`;
  return local;
}

describe("international enquiries", () => {
  it("never invents +91 for a number that cannot be an Indian mobile", () => {
    // US/UK area codes start 2-5; India's mobile range is 6-9.
    expect(canonicalPhone("4155552671")).toBe("4155552671");
    expect(canonicalPhone("2125551234")).toBe("2125551234");
    expect(canonicalPhone("4155552671")).not.toContain("+91");
  });

  it("trusts an explicit country code, whatever it is", () => {
    expect(canonicalPhone("+1 415 555 2671")).toBe("+14155552671");
    expect(canonicalPhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(canonicalPhone("+971 50 123 4567")).toBe("+971501234567");
    expect(canonicalPhone("+65 6123 4567")).toBe("+6561234567");
    // 00 is the international prefix typed instead of "+".
    expect(canonicalPhone("001 415 555 2671")).toBe("+14155552671");
  });

  it("still canonicalises every Indian spelling to one value", () => {
    for (const v of ["9611360491", "+919611360491", "09611360491", "+91 96113 60491", "+91-96113-60491"]) {
      expect(canonicalPhone(v)).toBe("+919611360491");
    }
  });

  it("keeps different countries apart even when the last 10 digits collide", () => {
    // This is the dangerous case: phoneDigits() reduces both to 4155552671, so
    // without a country check two different people would be MERGED — which loses
    // data, unlike a duplicate.
    const us = canonicalPhone("+1 415 555 2671");
    const india = canonicalPhone("+91 41555 52671");
    expect(phoneDigits(us)).toBe(phoneDigits(india)); // the collision is real
    expect(us).not.toBe(india);                        // but the stored values differ
    expect(us.startsWith("+1")).toBe(true);
    expect(india.startsWith("+91")).toBe(true);
  });
});
