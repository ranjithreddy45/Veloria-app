import { describe, it, expect, vi } from "vitest";

// otp.ts pulls in prisma, next-auth, WhatsApp and logging; these tests only use its
// pure phone rule, so the heavy imports are stubbed (as otp.test.ts does).
vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => ({ success: true, remaining: 1, resetIn: 0 }) }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn() }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = "credentials";
  },
}));

import { normalizeOtpPhone } from "@/lib/otp";
import {
  PHONE_INVALID_MESSAGE,
  checkPhone,
  collaboratorPhoneForStorage,
  displayPhone,
  guestPhoneForStorage,
  phoneKey,
  samePhone,
  splitDuplicatePhones,
} from "./host-phone";

function digitsOf(raw: string): string {
  const res = checkPhone(raw);
  if (res.kind !== "VALID") throw new Error(`expected VALID for ${JSON.stringify(raw)}, got ${res.kind}`);
  return res.digits;
}

describe("checkPhone — optional, validated, normalised with the sign-in rule", () => {
  it("treats nothing typed as no phone (guests may not have one)", () => {
    for (const raw of ["", "   ", null, undefined, "‪‬"]) {
      expect(checkPhone(raw)).toEqual({ kind: "EMPTY" });
    }
  });

  it("accepts the ways people type an Indian mobile and lands on one form", () => {
    for (const raw of ["9876543210", "98765 43210", "+91 98765-43210", "(+91) 98765 43210", "098765 43210", "919876543210", "+91.98765.43210"]) {
      expect(digitsOf(raw)).toBe("919876543210");
    }
  });

  it("stores exactly what normalizeOtpPhone produces, so a co-host's sign-in number matches", () => {
    for (const raw of ["98765 43210", "+91 98765 43210", "09876543210", "+1 (415) 555-0100", "+44 7700 900123"]) {
      expect(digitsOf(raw)).toBe(normalizeOtpPhone(raw));
    }
  });

  it("reads 0091 as the dialling form of +91", () => {
    expect(digitsOf("0091 98765 43210")).toBe("919876543210");
  });

  it("strips the invisible marks contacts apps paste around numbers", () => {
    expect(digitsOf("‪+91 98765 43210‬")).toBe("919876543210");
    expect(digitsOf("98765​43210")).toBe("919876543210");
  });

  it("keeps full international numbers", () => {
    expect(digitsOf("+1 415 555 0100")).toBe("14155550100");
    expect(digitsOf("+44 7700 900123")).toBe("447700900123");
  });

  it("refuses numbers WhatsApp can't reach, with a message for the field", () => {
    for (const raw of [
      "12345", // too short
      "98765 4321", // nine digits
      "4155550100", // ten digits that aren't an Indian mobile
      "+91 12345 67890", // Indian, but not a mobile
      "+91 098765 43210", // trunk zero after the country code
      "+1234567890123456", // longer than E.164
      "call me", // not a number
      "98765 43210 ext 2", // extension text
    ]) {
      expect(checkPhone(raw)).toEqual({ kind: "INVALID", error: PHONE_INVALID_MESSAGE });
    }
  });
});

describe("storage forms", () => {
  it("guests keep the '+' form the team's list prints; co-hosts keep the sign-in form", () => {
    const digits = digitsOf("98765 43210");
    expect(guestPhoneForStorage(digits)).toBe("+919876543210");
    expect(collaboratorPhoneForStorage(digits)).toBe("919876543210");
  });

  it("a stored guest phone re-reads to the same digits (idempotent)", () => {
    const stored = guestPhoneForStorage(digitsOf("09876543210"));
    expect(digitsOf(stored)).toBe("919876543210");
  });
});

describe("samePhone — duplicates across formats", () => {
  it("matches one number however it was stored", () => {
    expect(samePhone("+919876543210", "09876543210")).toBe(true);
    expect(samePhone("98765 43210", "919876543210")).toBe(true);
    expect(samePhone("0091 98765 43210", "+91 98765 43210")).toBe(true);
  });

  it("never matches missing or too-short values", () => {
    expect(samePhone(null, "+919876543210")).toBe(false);
    expect(samePhone("+919876543210", undefined)).toBe(false);
    expect(samePhone("123", "123")).toBe(false);
    expect(samePhone("+919876543210", "+919876543211")).toBe(false);
  });
});

describe("phoneKey and splitDuplicatePhones — one number, one guest on an import", () => {
  it("gives one key for one number however it was written, and none for a too-short value", () => {
    for (const raw of ["+919876543210", "09876543210", "98765 43210", "0091 98765 43210"]) {
      expect(phoneKey(raw), raw).toBe("919876543210");
    }
    expect(phoneKey("123")).toBeNull();
    expect(phoneKey("")).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });

  it("leaves out rows whose number is on the list already or earlier in the same import, and keeps rows without one", () => {
    const rows = [
      { name: "Aarav", phone: "+919876543210" }, // on the list already, stored as "98765 43210"
      { name: "Priya", phone: "+919998887766" },
      { name: "Priya again", phone: "+91 99988 87766" }, // repeated within the import
      { name: "No phone", phone: null },
      { name: "Also no phone", phone: undefined },
      { name: "Ravi", phone: "+14155550100" },
    ];
    const { keep, duplicates } = splitDuplicatePhones(rows, ["98765 43210", null, "+447700900123"]);
    expect(keep.map((r) => r.name)).toEqual(["Priya", "No phone", "Also no phone", "Ravi"]);
    expect(duplicates.map((r) => r.name)).toEqual(["Aarav", "Priya again"]);
  });

  it("keeps every row when no number repeats", () => {
    const rows = [{ phone: "+919876543210" }, { phone: "+919876543211" }];
    expect(splitDuplicatePhones(rows, [])).toEqual({ keep: rows, duplicates: [] });
  });
});

describe("displayPhone", () => {
  it("groups Indian mobiles, keeps international numbers, and leaves anything else as stored", () => {
    expect(displayPhone("+919876543210")).toBe("+91 98765 43210");
    expect(displayPhone("98765 43210")).toBe("+91 98765 43210");
    expect(displayPhone("+14155550100")).toBe("+14155550100");
    expect(displayPhone("080 2345 678")).toBe("080 2345 678");
    expect(displayPhone("")).toBeNull();
    expect(displayPhone(null)).toBeNull();
  });
});
