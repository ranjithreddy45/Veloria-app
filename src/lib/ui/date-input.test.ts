import { describe, it, expect } from "vitest";
import { isCommittableDate } from "./date-input";

describe("isCommittableDate", () => {
  it("holds back the partial years a date box reports while the year is typed", () => {
    for (const v of ["0002-11-01", "0020-11-01", "0202-11-01"]) expect(isCommittableDate(v)).toBe(false);
    expect(isCommittableDate("2026-11-01")).toBe(true);
  });

  it("applies a cleared box, and rejects junk and absurd years", () => {
    expect(isCommittableDate("")).toBe(true);
    expect(isCommittableDate("2026-13-01")).toBe(false);
    expect(isCommittableDate("1999-12-31")).toBe(false);
    expect(isCommittableDate("2101-01-01")).toBe(false);
    expect(isCommittableDate("26-11-01")).toBe(false);
  });
});
