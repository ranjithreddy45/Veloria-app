import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generate } from "otplib";
import {
  buildOtpauthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  formatManualKey,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
  safeEqualHex,
  totpStepFromDate,
  verifyTotpCode,
} from "./two-factor";

const ORIGINAL_ENV = { ...process.env };

describe("two-factor primitives", () => {
  beforeEach(() => {
    process.env.TOTP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("encrypts and decrypts a secret (AES-256-GCM, random IV)", () => {
    const secret = generateTotpSecret();
    const a = encryptTotpSecret(secret);
    const b = encryptTotpSecret(secret);
    expect(a).not.toEqual(b); // fresh IV every time
    expect(a.startsWith("v1.")).toBe(true);
    expect(decryptTotpSecret(a)).toBe(secret);
    expect(decryptTotpSecret(b)).toBe(secret);
  });

  it("rejects a tampered ciphertext", () => {
    const enc = encryptTotpSecret(generateTotpSecret());
    const [v, iv, ct, tag] = enc.split(".");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 0xff;
    expect(() =>
      decryptTotpSecret([v, iv, flipped.toString("base64"), tag].join("."))
    ).toThrow();
  });

  it("falls back to an AUTH_SECRET-derived key when TOTP_ENCRYPTION_KEY is unset", () => {
    delete process.env.TOTP_ENCRYPTION_KEY;
    process.env.AUTH_SECRET = "test-auth-secret";
    const secret = generateTotpSecret();
    expect(decryptTotpSecret(encryptTotpSecret(secret))).toBe(secret);
  });

  it("builds a Google-Authenticator-compatible otpauth URI", () => {
    const uri = buildOtpauthUri("owner@veloriagrand.com", "JBSWY3DPEHPK3PXP");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=Veloria%20Grand");
    expect(formatManualKey("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });

  it("verifies the current code, rejects garbage, and flags replays", async () => {
    const secret = generateTotpSecret();
    const code = await generate({ secret });

    const ok = await verifyTotpCode(secret, code);
    expect(ok.valid).toBe(true);
    if (!ok.valid) return;
    expect(ok.timeStep).toBe(totpStepFromDate(new Date(ok.epoch * 1000)));

    // Same code again, with the accepted step as the replay floor.
    const replay = await verifyTotpCode(secret, code, ok.timeStep);
    expect(replay).toEqual({ valid: false, reason: "reused" });

    expect(await verifyTotpCode(secret, "000000")).toMatchObject({ valid: false });
    expect(await verifyTotpCode(secret, "12345")).toEqual({ valid: false, reason: "invalid" });
    expect(await verifyTotpCode(secret, "abcdef")).toEqual({ valid: false, reason: "invalid" });
  });

  it("generates 8 unique, typeable recovery codes with per-user hashes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) {
      expect(c).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{5}-[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{5}$/);
      expect(looksLikeRecoveryCode(c)).toBe(true);
      expect(looksLikeRecoveryCode(c.toLowerCase().replace("-", " "))).toBe(true);
    }
    expect(normalizeRecoveryCode(" k7mp3-q9xz2 ")).toBe("K7MP3Q9XZ2");
    expect(looksLikeRecoveryCode("123456")).toBe(false);

    const h1 = hashRecoveryCode(codes[0], "user-a");
    expect(hashRecoveryCode(codes[0].toLowerCase(), "user-a")).toBe(h1);
    expect(hashRecoveryCode(codes[0], "user-b")).not.toBe(h1);
    expect(safeEqualHex(h1, h1)).toBe(true);
    expect(safeEqualHex(h1, hashRecoveryCode(codes[1], "user-a"))).toBe(false);
    expect(safeEqualHex("", h1)).toBe(false);
  });
});
