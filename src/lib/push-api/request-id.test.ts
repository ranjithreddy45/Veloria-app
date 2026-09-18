import { describe, expect, it } from "vitest";
import { newRequestId, REQUEST_ID_PATTERN } from "./request-id";

describe("newRequestId", () => {
  it("has the req_ + 26-character ULID shape", () => {
    for (let i = 0; i < 50; i++) expect(newRequestId()).toMatch(REQUEST_ID_PATTERN);
  });

  it("sorts by time", () => {
    const earlier = newRequestId(1_700_000_000_000);
    const later = newRequestId(1_700_000_000_001);
    expect(earlier.slice(0, 14) < later.slice(0, 14)).toBe(true);
  });

  it("does not collide within the same millisecond", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newRequestId(1_700_000_000_000)));
    expect(ids.size).toBe(2000);
  });
});
