import { describe, expect, it } from "vitest";
import { isCallLeadSource } from "./call-lead";

describe("isCallLeadSource", () => {
  it("only CallVibe's push source is a handled call", () => {
    expect(isCallLeadSource("callvibe")).toBe(true);
    expect(isCallLeadSource(" CallVibe ")).toBe(true);
    for (const s of ["phone", "website", "google_ads", "meta_ads", "", null, undefined]) expect(isCallLeadSource(s)).toBe(false);
  });
});
