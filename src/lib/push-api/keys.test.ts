import { describe, expect, it } from "vitest";
import { bearerToken, evaluateKey, generatePushKey, hashApiKey, PUSH_KEY_PREFIX } from "./keys";

const active = { isActive: true, revokedAt: null, expiresAt: null, scopes: ["leads:create"] };

describe("generatePushKey", () => {
  it("issues a vg_live_ key whose stored hash is the SHA-256 of the raw key", () => {
    const { raw, hash, prefix } = generatePushKey();
    expect(raw.startsWith(PUSH_KEY_PREFIX)).toBe(true);
    expect(raw.length).toBeGreaterThan(40);
    expect(hash).toBe(hashApiKey(raw));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(raw.startsWith(prefix)).toBe(true);
    // The display prefix must not give away enough of the key to matter.
    expect(prefix.length).toBeLessThan(raw.length / 2);
  });

  it("never issues the same key twice", () => {
    const keys = new Set(Array.from({ length: 500 }, () => generatePushKey().raw));
    expect(keys.size).toBe(500);
  });
});

describe("bearerToken", () => {
  it("reads a Bearer token", () => {
    expect(bearerToken("Bearer vg_live_abc")).toBe("vg_live_abc");
    expect(bearerToken("bearer   vg_live_abc  ")).toBe("vg_live_abc");
  });
  it("rejects anything else", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("vg_live_abc")).toBeNull();
    expect(bearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
  });
});

describe("evaluateKey", () => {
  const now = new Date("2026-09-17T10:00:00Z");

  it("accepts an active key with the scope", () => {
    expect(evaluateKey(active, "leads:create", now)).toEqual({ ok: true });
  });

  it("accepts a key that expires in the future", () => {
    expect(evaluateKey({ ...active, expiresAt: new Date("2026-09-18T00:00:00Z") }, "leads:create", now).ok).toBe(true);
  });

  it("refuses a revoked key, by flag or by timestamp", () => {
    expect(evaluateKey({ ...active, isActive: false }, "leads:create", now)).toMatchObject({ ok: false, code: "API_KEY_REVOKED" });
    expect(evaluateKey({ ...active, revokedAt: new Date() }, "leads:create", now)).toMatchObject({ ok: false, code: "API_KEY_REVOKED" });
  });

  it("refuses an expired key, including at the exact expiry instant", () => {
    expect(evaluateKey({ ...active, expiresAt: new Date("2026-09-17T09:00:00Z") }, "leads:create", now)).toMatchObject({
      ok: false,
      code: "API_KEY_EXPIRED",
    });
    expect(evaluateKey({ ...active, expiresAt: now }, "leads:create", now)).toMatchObject({ ok: false, code: "API_KEY_EXPIRED" });
  });

  it("says revoked, not expired, when a key is both", () => {
    expect(
      evaluateKey({ ...active, isActive: false, expiresAt: new Date("2020-01-01") }, "leads:create", now)
    ).toMatchObject({ code: "API_KEY_REVOKED" });
  });

  it("refuses a key without the scope — including every legacy key, which has none", () => {
    expect(evaluateKey({ ...active, scopes: [] }, "leads:create", now)).toMatchObject({ ok: false, code: "INSUFFICIENT_SCOPE" });
    expect(evaluateKey({ ...active, scopes: ["bookings:create"] }, "leads:create", now)).toMatchObject({
      ok: false,
      code: "INSUFFICIENT_SCOPE",
    });
  });
});
