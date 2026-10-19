import { describe, it, expect } from "vitest";
import { excludedCampaignFragments, excludedCampaignMatch } from "./exclusions";

describe("Meta campaign exclusions", () => {
  it("keeps Hotel sales and Venue acquisition out by default", () => {
    expect(excludedCampaignMatch({ campaignName: "Hotel Sales | Oct 2026" })).toBe("hotel sales");
    expect(excludedCampaignMatch({ campaignName: "VENUE_ACQUISITION - owners" })).toBe("venue acquisition");
    expect(excludedCampaignMatch({ campaignName: "Leads", formName: "Venue-Acquisition form" })).toBe("venue acquisition");
    expect(excludedCampaignMatch({ adsetName: "hotel sales bangalore" })).toBe("hotel sales");
  });

  it("imports everything else, including leads with no names at all", () => {
    expect(excludedCampaignMatch({ campaignName: "Wedding Hall Leads Oct" })).toBeNull();
    expect(excludedCampaignMatch({ campaignName: "Hotel booking enquiries" })).toBeNull();
    expect(excludedCampaignMatch({})).toBeNull();
  });

  it("can be overridden from the environment, or switched off", () => {
    expect(excludedCampaignFragments(undefined)).toEqual(["hotel sales", "venue acquisition"]);
    expect(excludedCampaignFragments("none")).toEqual([]);
    expect(excludedCampaignFragments(" Hotel Sales , ")).toEqual(["hotel sales"]);
    expect(excludedCampaignMatch({ campaignName: "Hotel Sales" }, [])).toBeNull();
  });
});
