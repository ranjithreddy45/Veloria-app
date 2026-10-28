import { describe, it, expect } from "vitest";
import { canViewLead, buildLeadListWhere, resolveTeamView } from "./lead-filters";

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

describe("buildLeadListWhere — occasion", () => {
  it("matches every raw spelling resolved for the key", () => {
    const { where } = buildLeadListWhere(
      { scope: "all", occasion: "birthday", occasionValues: ["Birthday", "Birthday Party"] },
      MANAGER
    );
    expect(where.AND).toEqual([{ eventType: { in: ["Birthday", "Birthday Party"] } }]);
  });

  it("returns NO rows for an occasion nobody has, rather than dropping the filter", () => {
    const { where } = buildLeadListWhere({ scope: "all", occasion: "sangeet", occasionValues: [] }, MANAGER);
    expect(where.AND).toEqual([{ eventType: { in: [] } }]);
  });

  it("NONE means null, empty or whitespace-only — all three are 'not recorded'", () => {
    const { where } = buildLeadListWhere({ scope: "all", occasion: "NONE", occasionValues: ["  "] }, MANAGER);
    expect(where.AND).toEqual([{ OR: [{ eventType: null }, { eventType: { in: ["", "  "] } }] }]);
  });

  it("adds nothing when no occasion is asked for", () => {
    expect(buildLeadListWhere({ scope: "all" }, MANAGER).where.AND).toBeUndefined();
  });

  it("is an AND entry, so it cannot clobber the rep's own-leads scope", () => {
    const { where } = buildLeadListWhere({ occasion: "wedding", occasionValues: ["Wedding"] }, REP);
    expect(where.AND).toHaveLength(1);
    expect(Object.keys(where).length).toBeGreaterThan(2); // deletedAt + scope + AND
  });
});

describe("canViewLead — opening one lead by id (R1-4 / L18)", () => {
  const rep = { id: "rep-a", role: "SALES_EXEC" };
  it("a sales exec cannot open another rep's lead, or an unassigned one", () => {
    expect(canViewLead(rep, { assignedToId: "rep-b" })).toBe(false);
    expect(canViewLead(rep, { assignedToId: null })).toBe(false);
  });
  it("the assignee can", () => {
    expect(canViewLead(rep, { assignedToId: "rep-a" })).toBe(true);
  });
  it("a sales head or admin can open any lead", () => {
    expect(canViewLead({ id: "head", role: "SALES_HEAD" }, { assignedToId: "rep-b" })).toBe(true);
    expect(canViewLead({ id: "admin", role: "ADMIN" }, { assignedToId: null })).toBe(true);
  });
});

describe("sales teams — each team works its own CRM", () => {
  const WED_REP = { id: "w1", role: "SALES_EXEC", salesTeam: "WEDDING" };
  const HEAD = { id: "h1", role: "SALES_HEAD", salesTeam: "WEDDING" };

  it("a rep in a team opens every lead of their team, and none of another team's", () => {
    expect(canViewLead(WED_REP, { assignedToId: "w2", salesTeam: "WEDDING" })).toBe(true);
    expect(canViewLead(WED_REP, { assignedToId: "c1", salesTeam: "CORPORATE" })).toBe(false);
    expect(canViewLead(WED_REP, { assignedToId: null, salesTeam: null })).toBe(false);
    // Their own lead stays theirs even after it moves to another team.
    expect(canViewLead(WED_REP, { assignedToId: "w1", salesTeam: "SOCIAL" })).toBe(true);
  });

  it("a rep in no team is not let into Unsorted leads through a null-equals-null match", () => {
    expect(canViewLead({ id: "x", role: "SALES_EXEC", salesTeam: null }, { assignedToId: "y", salesTeam: null })).toBe(false);
  });

  it("defaults a team rep to the team scope, and holds them to it", () => {
    expect(buildLeadListWhere({}, WED_REP)).toMatchObject({ scope: "team", viewerTeam: "WEDDING" });
    expect(buildLeadListWhere({}, WED_REP).where.salesTeam).toBe("WEDDING");
    expect(buildLeadListWhere({}, WED_REP).where.assignedToId).toBeUndefined();
    // "all" and a team filter are manager views: downgraded / ignored.
    const r = buildLeadListWhere({ scope: "all", team: "CORPORATE" }, WED_REP);
    expect(r.scope).toBe("team");
    expect(r.where.salesTeam).toBe("WEDDING");
    expect(r.teamFilter).toBeNull();
    // "My leads" still works for them.
    expect(buildLeadListWhere({ scope: "mine" }, WED_REP).where.assignedToId).toBe("w1");
  });

  it("keeps a rep in no team on their own book", () => {
    const r = buildLeadListWhere({ scope: "team" }, REP);
    expect(r.scope).toBe("mine");
    expect(r.where.assignedToId).toBe("u2");
  });

  it("lets a manager narrow any scope to one team or to Unsorted", () => {
    expect(buildLeadListWhere({ scope: "all", team: "SOCIAL" }, MANAGER).where.salesTeam).toBe("SOCIAL");
    const u = buildLeadListWhere({ scope: "all", team: "UNSORTED" }, MANAGER);
    expect(u.where.salesTeam).toBeNull();
    expect(u.teamFilter).toBe("UNSORTED");
    expect(buildLeadListWhere({ scope: "all", team: "NONSENSE" }, MANAGER).where.salesTeam).toBeUndefined();
    // A head who is in a team still defaults to "My leads", like every manager.
    expect(buildLeadListWhere({}, HEAD).scope).toBe("mine");
  });

  it("resolveTeamView: managers pick, team reps are pinned, others see everything", () => {
    expect(resolveTeamView(MANAGER, "CORPORATE")).toBe("CORPORATE");
    expect(resolveTeamView(MANAGER, "UNSORTED")).toBe("UNSORTED");
    expect(resolveTeamView(MANAGER, "junk")).toBeNull();
    expect(resolveTeamView(WED_REP, "CORPORATE")).toBe("WEDDING");
    expect(resolveTeamView(WED_REP, null)).toBe("WEDDING");
    expect(resolveTeamView(REP, "CORPORATE")).toBeNull();
  });
});

describe("worklist buckets (due) narrow a picked status instead of replacing it", () => {
  const M = { id: "m", role: "SUPER_ADMIN" };
  it("overdue + New → only New leads with an overdue follow-up", () => {
    const w = buildLeadListWhere({ scope: "all", due: "overdue", status: "NEW" }, M).where;
    expect(w.status).toBe("NEW");
    expect(w.followUpDate).toMatchObject({ not: null });
  });
  it("untouched with no status → every open status", () => {
    const w = buildLeadListWhere({ scope: "all", due: "untouched" }, M).where;
    expect(w.status).toEqual({ in: ["NEW", "NOT_CONNECTED", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"] });
    expect(w.lastTouchedAt).toBeNull();
  });
  it("a closed status with a due bucket matches nothing (never the open list)", () => {
    expect(buildLeadListWhere({ scope: "all", due: "overdue", status: "WON" }, M).where.status).toEqual({ in: [] });
  });
});
