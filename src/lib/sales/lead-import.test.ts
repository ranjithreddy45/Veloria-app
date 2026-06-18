import { describe, it, expect } from "vitest";
import {
  parseCsv,
  rowsFromCsv,
  mapLeadStatus,
  normalizePhone,
  splitName,
  toNumber,
  parseFlexibleDate,
} from "./lead-import";

describe("lead-import CSV parser", () => {
  it("handles quoted fields with embedded commas", () => {
    const csv =
      'Lead Name,Phone No.,Add ons\nSurabhi,7666379810,"decor, cake 4kg, photography"\n';
    const grid = parseCsv(csv);
    expect(grid).toHaveLength(2);
    expect(grid[1]).toEqual(["Surabhi", "7666379810", "decor, cake 4kg, photography"]);
  });

  it("maps headers to fields and skips the header row", () => {
    const csv =
      "Sl No,Lead Name,Phone No.,No of attendees,Status\n1,Neha,9611360491,150,Boooked\n";
    const rows = rowsFromCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].leadName).toBe("Neha");
    expect(rows[0].phone).toBe("9611360491");
    expect(rows[0].attendees).toBe("150");
    expect(rows[0].status).toBe("Boooked");
  });

  it("ignores trailing empty columns (ragged rows)", () => {
    const csv = "Lead Name,Phone No.,,,\nSurabhi,7666379810,,,\n";
    const rows = rowsFromCsv(csv);
    expect(rows[0].leadName).toBe("Surabhi");
  });
});

describe("lead-import field mappers", () => {
  it("maps statuses incl. typos", () => {
    expect(mapLeadStatus("Positive")).toBe("QUALIFIED");
    expect(mapLeadStatus("Boooked")).toBe("WON");
    expect(mapLeadStatus("Booked")).toBe("WON");
    expect(mapLeadStatus("Lost")).toBe("LOST");
    expect(mapLeadStatus("")).toBe("NEW");
  });

  it("normalizes phone (drops the .0 float artefact)", () => {
    expect(normalizePhone("7666379810.0")).toBe("7666379810");
    expect(normalizePhone("9611360491")).toBe("9611360491");
    expect(normalizePhone("+91 96113 60491")).toBe("+91 96113 60491");
    expect(normalizePhone("abc")).toBeNull();
  });

  it("splits names", () => {
    expect(splitName("Surabhi")).toEqual({ firstName: "Surabhi", lastName: "" });
    expect(splitName("Sureka Kumar")).toEqual({ firstName: "Sureka", lastName: "Kumar" });
  });

  it("parses money/counts", () => {
    expect(toNumber("146853")).toBe(146853);
    expect(toNumber("₹3,01,140")).toBe(301140);
    expect(toNumber("30000.0")).toBe(30000);
  });

  it("parses normal and half-formed dates", () => {
    expect(parseFlexibleDate("2026-08-28")?.toISOString().slice(0, 10)).toBe("2026-08-28");
    // "19/072026" -> 19 July 2026
    expect(parseFlexibleDate("19/072026")?.toISOString().slice(0, 10)).toBe("2026-07-19");
    expect(parseFlexibleDate("06/07/2026")?.toISOString().slice(0, 10)).toBe("2026-07-06");
    expect(parseFlexibleDate("")).toBeNull();
  });
});
