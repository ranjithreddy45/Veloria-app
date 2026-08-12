import { describe, it, expect } from "vitest";
import { buildLeadListWhere } from "./lead-filters";

// A manager (leads:assign) so scope is not silently downgraded to "mine".
const MANAGER = { id: "u1", role: "SUPER_ADMIN" };
const REP = { id: "u2", role: "SALES_EXEC" };

describe("buildLeadListWhere — shared by the leads list AND the CSV export", () => {
  it("applies the same filters for both callers", () => {
    // The export used to take no filters at all, so this is the guarantee that
    // matters: one input, one where-clause, whoever asks.
    const w = buildLeadListWhere(
      { scope: "all", status: "NEW", enquirySource: "GOOGLE_ADS" },
      MANAGER
    ).where;
    expect(w.status).toBe("NEW");
    expect(w.contact).toEqual({ enquirySource: "GOOGLE_ADS" });
    expect(w.deletedAt).toBeNull();
  });

  it("still confines a rep to their own book when they ask for everything", () => {
    // The export previously re-implemented this guard by hand. Inheriting it
    // means an own-book rep cannot CSV-download the whole company by editing a
    // URL.
    const r = buildLeadListWhere({ scope: "all" }, REP);
    expect(r.scope).toBe("mine");
    expect(r.where.assignedToId).toBe("u2");
  });

  it("ignores junk instead of throwing at the database", () => {
    const w = buildLeadListWhere(
      { scope: "all", status: "NONSENSE", enquirySource: "not-a-channel" },
      MANAGER
    ).where;
    expect(w.status).toBeUndefined();
    expect(w.contact).toBeUndefined();
  });

  it("filters by created-date range", () => {
    const w = buildLeadListWhere(
      { scope: "all", createdFrom: "2026-08-01", createdTo: "2026-08-31" },
      MANAGER
    ).where as { createdAt?: { gte?: Date; lte?: Date } };
    expect(w.createdAt?.gte).toBeInstanceOf(Date);
    expect(w.createdAt?.lte).toBeInstanceOf(Date);
    expect(w.createdAt!.gte!.getTime()).toBeLessThan(w.createdAt!.lte!.getTime());
  });

  it("selects never-contacted leads for the untouched worklist", () => {
    const w = buildLeadListWhere({ scope: "all", due: "untouched" }, MANAGER).where;
    expect(w.lastTouchedAt).toBeNull();
  });
});
