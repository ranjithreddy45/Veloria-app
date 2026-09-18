import { describe, expect, it } from "vitest";
import { canonicalJson, requestHash, validIdempotencyKey } from "./idempotency";

describe("canonicalJson / requestHash", () => {
  it("ignores key order at every depth", () => {
    const a = { source: "meta_ads", name: "Rahul", metadata: { b: 1, a: [1, { y: 2, x: 1 }] } };
    const b = { metadata: { a: [1, { x: 1, y: 2 }], b: 1 }, name: "Rahul", source: "meta_ads" };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(requestHash(a)).toBe(requestHash(b));
  });

  it("changes when any value changes", () => {
    expect(requestHash({ phone: "+919876543210" })).not.toBe(requestHash({ phone: "+919876543211" }));
    expect(requestHash({ tags: [1, 2] })).not.toBe(requestHash({ tags: [2, 1] }));
  });

  it("treats an explicit undefined like an absent key", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });
});

describe("validIdempotencyKey", () => {
  it("accepts printable ASCII up to 255 characters", () => {
    expect(validIdempotencyKey("meta-lead-123456789")).toBe(true);
    expect(validIdempotencyKey("a".repeat(255))).toBe(true);
  });
  it("refuses empty, oversized, whitespace and non-ASCII keys", () => {
    expect(validIdempotencyKey("")).toBe(false);
    expect(validIdempotencyKey("a".repeat(256))).toBe(false);
    expect(validIdempotencyKey("has space")).toBe(false);
    expect(validIdempotencyKey("ключ")).toBe(false);
  });
});
