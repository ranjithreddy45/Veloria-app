import { describe, it, expect } from "vitest";
import { cn, formatINR, serialize } from "./utils";

describe("formatINR", () => {
  it("formats a number as Indian Rupees", () => {
    // en-IN grouping: 1,00,000 not 100,000
    expect(formatINR(100000)).toContain("1,00,000");
    expect(formatINR(100000)).toContain("₹");
  });

  it("returns a placeholder for null/undefined/NaN instead of crashing", () => {
    expect(formatINR(null)).toBe("--");
    expect(formatINR(undefined)).toBe("--");
    expect(formatINR("not a number")).toBe("--");
  });

  it("accepts numeric strings (e.g. serialized Prisma Decimals)", () => {
    expect(formatINR("250000")).toContain("2,50,000");
  });

  it("handles zero", () => {
    expect(formatINR(0)).toContain("0");
  });
});

describe("serialize", () => {
  it("converts Prisma Decimal-like objects (with toNumber) to numbers", () => {
    const fakeDecimal = { toNumber: () => 1234.56 };
    const result = serialize({ amount: fakeDecimal });
    expect(result.amount).toBe(1234.56);
    expect(typeof result.amount).toBe("number");
  });

  it("deep-converts nested Decimals in arrays", () => {
    const data = {
      invoices: [
        { total: { toNumber: () => 100 } },
        { total: { toNumber: () => 200 } },
      ],
    };
    const result = serialize(data);
    expect(result.invoices[0].total).toBe(100);
    expect(result.invoices[1].total).toBe(200);
  });

  it("leaves plain values untouched", () => {
    const data = { name: "Veloria", count: 5, active: true };
    expect(serialize(data)).toEqual(data);
  });
});

describe("cn", () => {
  it("keeps a type-scale size next to a text colour", () => {
    // tailwind-merge used to read text-detail as a colour and drop it here.
    expect(cn("text-detail font-medium", "text-muted-foreground")).toBe("text-detail font-medium text-muted-foreground");
    expect(cn("text-h2", "text-destructive")).toBe("text-h2 text-destructive");
  });

  it("still lets a later size replace an earlier one", () => {
    expect(cn("text-meta", "text-body")).toBe("text-body");
    expect(cn("text-sm", "text-copy")).toBe("text-copy");
  });
});
