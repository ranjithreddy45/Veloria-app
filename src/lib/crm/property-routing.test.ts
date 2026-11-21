import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Property routing (Google Ads brief, Nov 2026). Prisma is mocked: these tests
// pin the resolution order (explicit property > campaign > text hint > venue)
// and the owner rules (corporate-only Bellandur, shared queue, routing off
// until an owner exists).
// ============================================================

const { db } = vi.hoisted(() => ({
  db: {
    leadProperty: { findMany: vi.fn() },
    leadCampaignRoute: { findUnique: vi.fn() },
    venue: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));

import { campaignIdFrom, matchPropertyByText, normalisePropertyKey, routeLeadToProperty } from "./property-routing";

const row = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  name: `Veloria Grand ${key}`,
  matchTerms: [] as string[],
  corporateOnly: false,
  ownerId: `u-${key}`,
  venueId: null as string | null,
  ...over,
});

const ROWS = [
  row("hosa_road", { matchTerms: ["hosa road", "singasandra"] }),
  row("electronic_city", { matchTerms: ["electronic city", "e city"] }),
  row("hsr", { matchTerms: ["hsr layout"] }),
  row("bellandur", { matchTerms: ["bellandur"], corporateOnly: true }),
  row("yelahanka", { matchTerms: ["yelahanka"], venueId: "v-yel" }),
  row("kr_puram", { matchTerms: ["k r puram"] }),
  row("other", { name: "Shared queue", ownerId: "u-queue" }),
];

beforeEach(() => {
  vi.clearAllMocks();
  db.leadProperty.findMany.mockResolvedValue(ROWS);
  db.leadCampaignRoute.findUnique.mockResolvedValue(null);
  db.venue.findUnique.mockResolvedValue(null);
  db.user.findUnique.mockResolvedValue({ role: "SALES_EXEC", isActive: true });
});

describe("text helpers", () => {
  it("normalises keys", () => {
    expect(normalisePropertyKey("KR Puram")).toBe("kr_puram");
    expect(normalisePropertyKey(" electronic-city ")).toBe("electronic_city");
    expect(normalisePropertyKey("")).toBeNull();
  });

  it("matches whole words, longest term wins, never the shared queue", () => {
    expect(matchPropertyByText("Veloria Grand KR Puram", ROWS)?.key).toBe("kr_puram");
    expect(matchPropertyByText("Yelahanka · Courtyard venue", ROWS)?.key).toBe("yelahanka");
    expect(matchPropertyByText("HSR Layout sector 2", ROWS)?.key).toBe("hsr");
    expect(matchPropertyByText("Hosur Road", ROWS)).toBeNull(); // not Hosa Road
    expect(matchPropertyByText("other", ROWS)).toBeNull();
    expect(matchPropertyByText("", ROWS)).toBeNull();
  });

  it("reads a campaign id from a number string or the old label", () => {
    expect(campaignIdFrom(undefined, "gads-campaign-24526650623")).toBe("24526650623");
    expect(campaignIdFrom("24521600526")).toBe("24521600526");
    expect(campaignIdFrom("summer-sale", null)).toBeNull();
  });
});

describe("routeLeadToProperty", () => {
  it("is off while no property has an owner", async () => {
    db.leadProperty.findMany.mockResolvedValue(ROWS.map((r) => ({ ...r, ownerId: null })));
    const r = await routeLeadToProperty({ property: "yelahanka" });
    expect(r.active).toBe(false);
    expect(r.propertyKey).toBe("yelahanka"); // still recorded
    expect(r.ownerId).toBeNull();
  });

  it("explicit property routes to its owner and fills the venue", async () => {
    const r = await routeLeadToProperty({ property: "yelahanka", campaignId: "111111" });
    expect(r).toMatchObject({ active: true, propertyKey: "yelahanka", ownerId: "u-yelahanka", venueId: "v-yel", flag: null, via: "property" });
    expect(db.leadCampaignRoute.findUnique).not.toHaveBeenCalled();
  });

  it("Google campaign id picks the property", async () => {
    db.leadCampaignRoute.findUnique.mockResolvedValue({ propertyKey: "kr_puram", isActive: true });
    const r = await routeLeadToProperty({ campaignId: "24526650626" });
    expect(r).toMatchObject({ propertyKey: "kr_puram", ownerId: "u-kr_puram", via: "campaign" });
  });

  it("a campaign with no property falls back to the location answer", async () => {
    db.leadCampaignRoute.findUnique.mockResolvedValue({ propertyKey: null, isActive: true });
    const r = await routeLeadToProperty({ campaignId: "999999", hints: ["Electronic City"] });
    expect(r).toMatchObject({ propertyKey: "electronic_city", via: "hint" });
  });

  it("Bellandur takes corporate enquiries only", async () => {
    const corp = await routeLeadToProperty({ property: "bellandur", eventType: "Corporate offsite" });
    expect(corp).toMatchObject({ ownerId: "u-bellandur", flag: null });
    const bday = await routeLeadToProperty({ property: "bellandur", eventType: "Birthday" });
    expect(bday).toMatchObject({ propertyKey: "bellandur", ownerId: "u-queue", flag: "NOT_CORPORATE" });
  });

  it("no property goes to the shared queue with a flag", async () => {
    const r = await routeLeadToProperty({ hints: ["somewhere else"] });
    expect(r).toMatchObject({ propertyKey: null, ownerId: "u-queue", flag: "NO_PROPERTY" });
  });

  it("an inactive owner sends the lead to the queue", async () => {
    db.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === "u-hsr" ? { role: "SALES_EXEC", isActive: false } : { role: "SALES_EXEC", isActive: true })
    );
    const r = await routeLeadToProperty({ property: "hsr" });
    expect(r).toMatchObject({ propertyKey: "hsr", ownerId: "u-queue", flag: "NO_OWNER" });
  });

  it("never throws", async () => {
    db.leadProperty.findMany.mockRejectedValue(new Error("db down"));
    const r = await routeLeadToProperty({ property: "hsr" });
    expect(r.active).toBe(false);
  });
});
