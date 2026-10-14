import { describe, expect, it } from "vitest";
import { buildPayslipMonths } from "./payslip-feed";

const run = (fy: string, month: number, status = "LOCKED") => ({ fy, month, label: null, status });
const doc = (id: string, year: number, month: number) => ({
  id, year, month, fileName: `${id}.pdf`, mimeType: "application/pdf", sizeBytes: 1000, note: null, updatedAt: "2026-10-01",
});

describe("buildPayslipMonths", () => {
  it("lists uploaded payslips even when payroll computed none", () => {
    const months = buildPayslipMonths([], [doc("aug", 2026, 8), doc("sep", 2026, 9)]);
    expect(months.map((m) => m.label)).toEqual(["September 2026", "August 2026"]);
    expect(months[0].uploaded?.id).toBe("sep");
    expect(months[0].computed).toBeNull();
  });

  it("puts a computed and an uploaded payslip for the same month in one entry", () => {
    const months = buildPayslipMonths([{ id: "c", net: 30000, run: run("2026-27", 8) }], [doc("u", 2026, 8)]);
    expect(months).toHaveLength(1);
    expect(months[0].computed?.id).toBe("c");
    expect(months[0].uploaded?.id).toBe("u");
  });

  it("orders by calendar month across the financial-year boundary", () => {
    // FY 2026-27 month 1 is January 2027, which is newer than December 2026.
    const months = buildPayslipMonths(
      [{ id: "jan", net: 1, run: run("2026-27", 1) }, { id: "dec", net: 1, run: run("2026-27", 12) }],
      [doc("mar26", 2026, 3)],
    );
    expect(months.map((m) => m.key)).toEqual(["2027-01", "2026-12", "2026-03"]);
  });
});
