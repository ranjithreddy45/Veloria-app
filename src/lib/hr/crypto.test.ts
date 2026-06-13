import { describe, it, expect, beforeAll } from "vitest";
import {
  encryptField, decryptField, isEncrypted, maskPan, maskAadhaar, maskAccount, maskTail,
} from "./crypto";

beforeAll(() => {
  // Deterministic key for the test run.
  process.env.HR_ENCRYPTION_KEY = "0".repeat(64); // 64 hex chars → 32 bytes
});

describe("hr-crypto encryptField / decryptField", () => {
  it("round-trips a value", () => {
    const token = encryptField("ABCDE1234F");
    expect(token).not.toContain("ABCDE1234F");
    expect(isEncrypted(token)).toBe(true);
    expect(decryptField(token)).toBe("ABCDE1234F");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptField("123412341234");
    const b = encryptField("123412341234");
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe("123412341234");
    expect(decryptField(b)).toBe("123412341234");
  });

  it("returns null for tampered or malformed tokens", () => {
    const token = encryptField("secret");
    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    expect(decryptField(tampered)).toBeNull();
    expect(decryptField("not-a-token")).toBeNull();
    expect(decryptField(null)).toBeNull();
    expect(decryptField("")).toBeNull();
  });

  it("isEncrypted distinguishes plaintext from tokens", () => {
    expect(isEncrypted("ABCDE1234F")).toBe(false);
    expect(isEncrypted(encryptField("x"))).toBe(true);
  });
});

describe("hr-crypto masking", () => {
  it("masks PAN keeping last 4", () => {
    expect(maskPan("ABCDE1234F")).toBe("••••••234F");
  });
  it("masks Aadhaar to last 4 in groups", () => {
    expect(maskAadhaar("1234 5678 9012")).toBe("XXXX XXXX 9012");
    expect(maskAadhaar("123456789012")).toBe("XXXX XXXX 9012");
  });
  it("masks bank account keeping last 4", () => {
    expect(maskAccount("000111222333")).toBe("••••••••2333");
  });
  it("maskTail handles short values and nulls", () => {
    expect(maskTail(null)).toBeNull();
    expect(maskTail("12")).toBe("••");
  });
});
