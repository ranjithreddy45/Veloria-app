import { describe, it, expect } from "vitest";
import { canonicalPhone, phoneForExport } from "./phone";

describe("phoneForExport — the shapes actually sitting in the database", () => {
  it("leaves an already-canonical number alone", () => {
    expect(phoneForExport("+919008123456")).toBe("+919008123456");
  });

  it("adds the country code to a bare Indian mobile", () => {
    // Typed by a rep in the contact form, which never canonicalised on write.
    // Bare digits are what a spreadsheet turns into a number.
    expect(phoneForExport("9008123456")).toBe("+919008123456");
  });

  it("strips a trunk zero rather than losing it to the spreadsheet", () => {
    // Excel silently eats the leading 0 when it types the cell as a number,
    // which turns a valid number into an invalid one with no warning.
    expect(phoneForExport("09008123456")).toBe("+919008123456");
  });

  it("handles the way people actually type numbers", () => {
    expect(phoneForExport("98765 43210")).toBe("+919876543210");
    expect(phoneForExport("+91 90081-23456")).toBe("+919008123456");
    expect(phoneForExport("091-9008123456")).toBe("+919008123456");
  });

  it("accepts a 12-digit number already country-coded", () => {
    expect(phoneForExport("919008123456")).toBe("+919008123456");
  });

  it("keeps a non-Indian international number as given", () => {
    expect(phoneForExport("+14155550100")).toBe("+14155550100");
    expect(phoneForExport("00447700900123")).toBe("+447700900123");
  });

  it("does NOT invent +91 for a number it cannot place", () => {
    // Guessing a country onto an unrecognised number produces a wrong number,
    // which is worse than an awkwardly formatted one.
    expect(phoneForExport("12345")).toBe("12345");
  });

  it("returns empty for missing values instead of 'null'", () => {
    expect(phoneForExport(null)).toBe("");
    expect(phoneForExport(undefined)).toBe("");
    expect(phoneForExport("")).toBe("");
  });

  it("is idempotent — exporting twice cannot double-prefix", () => {
    const once = phoneForExport("9008123456");
    expect(phoneForExport(once)).toBe(once);
  });

  it("still behaves as capture expects (same function, one rule)", () => {
    expect(canonicalPhone("9008123456")).toBe("+919008123456");
  });
});
