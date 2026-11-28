import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ lead: { findMany: vi.fn(), updateMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { backfillLeadAreas } from "./area-backfill";

describe("backfillLeadAreas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.lead.updateMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => ({ count: where.id.in.length }));
  });

  it("fills areas from venue and form answers, marks the rest as read, never overwrites", async () => {
    db.lead.findMany.mockResolvedValue([
      { id: "a", description: "preferred area in bengaluru?: North (Yelahanka, Hebbal)", preferredVenue: null },
      { id: "b", description: null, preferredVenue: { name: "Veloria Grand — Hosa Road · Grand Hall" } },
      { id: "c", description: "Auto-captured from callvibe", preferredVenue: null },
      { id: "d", description: "Venue: Hosa Road · Campaign: X", preferredVenue: null },
    ]);
    const res = await backfillLeadAreas(500);
    expect(res).toEqual({ scanned: 4, filled: 3 });
    const calls = db.lead.updateMany.mock.calls.map((c) => c[0]);
    // every update is guarded: only leads still never read
    expect(calls.every((c) => c.where.areaSource === null)).toBe(true);
    expect(calls.find((c) => c.data.area === "HOSA_ROAD")?.where.id.in.sort()).toEqual(["b"]);
    expect(calls.find((c) => c.data.area === "HOSA_ROAD" && c.data.areaSource === "form")?.where.id.in).toEqual(["d"]);
    expect(calls.find((c) => c.data.area === null)?.data.areaSource).toBe("none");
    // the owner is never touched
    expect(calls.every((c) => !("assignedToId" in c.data))).toBe(true);
  });

  it("does nothing once every lead has been read", async () => {
    db.lead.findMany.mockResolvedValue([]);
    expect(await backfillLeadAreas()).toEqual({ scanned: 0, filled: 0 });
    expect(db.lead.updateMany).not.toHaveBeenCalled();
  });
});
