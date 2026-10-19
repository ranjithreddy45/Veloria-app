import { describe, expect, it } from "vitest";
import { EVENT_TYPES } from "@/lib/constants";
import { isSalesTeam, salesTeamLabel, teamForEventType } from "./sales-team";

describe("teamForEventType", () => {
  it("sorts every standard event type", () => {
    const expected: Record<string, string | null> = {
      Anniversary: "SOCIAL", "Baby Shower": "SOCIAL", "Bachelor Party": "SOCIAL", "Birthday Party": "SOCIAL",
      "Cocktail Party": "WEDDING", Conference: "CORPORATE", "Corporate Event": "CORPORATE", "Corporate Party": "CORPORATE",
      Engagement: "WEDDING", "Fresher Party": "SOCIAL", "Get-together": "SOCIAL", Haldi: "WEDDING", "Kids Party": "SOCIAL",
      Mehandi: "WEDDING", "Naming Ceremony": "SOCIAL", "New Year Party": "SOCIAL", "Pre-Wedding Shoot": "WEDDING",
      Reception: "WEDDING", Sangeet: "WEDDING", Seminar: "CORPORATE", "Team Outing": "CORPORATE", Wedding: "WEDDING",
      Other: null,
    };
    for (const t of EVENT_TYPES) expect([t, teamForEventType(t)]).toEqual([t, expected[t]]);
  });
  it("handles the free text seen in production", () => {
    expect(teamForEventType("Birthday")).toBe("SOCIAL");
    expect(teamForEventType("Annriversary")).toBe("SOCIAL");
    expect(teamForEventType("Wedding Anniversary")).toBe("SOCIAL");
    expect(teamForEventType("inaguration function")).toBe("SOCIAL");
    expect(teamForEventType("Seniors get to gether")).toBe("SOCIAL");
    expect(teamForEventType("WEDDING")).toBe("WEDDING");
  });
  it("leaves unknown or missing event types Unsorted", () => {
    expect(teamForEventType(null)).toBeNull();
    expect(teamForEventType("")).toBeNull();
    expect(teamForEventType("Other")).toBeNull();
    expect(teamForEventType("xyz")).toBeNull();
  });
  it("labels and validates teams", () => {
    expect(salesTeamLabel("SOCIAL")).toBe("Social events");
    expect(salesTeamLabel(null)).toBe("Unsorted");
    expect(isSalesTeam("CORPORATE")).toBe(true);
    expect(isSalesTeam("UNSORTED")).toBe(false);
  });
});
