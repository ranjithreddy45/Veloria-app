import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  assignmentRule: { findMany: vi.fn() },
  user: { findUnique: vi.fn(async () => ({ isActive: true, role: "SALES_HEAD" })) },
}));
const m = vi.hoisted(() => ({ team: vi.fn(async () => "teamRep") }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/crm/sales-team-db", () => ({ pickTeamAssignee: m.team }));

import { evaluateAssignmentRules } from "./evaluate";

const rule = (conditions: unknown[], to = "nayana") => ({
  id: "r1", entityType: "LEAD", isActive: true, priority: 0, conditions, assignToUserId: to,
  assignToTeam: [], assignmentMethod: "DIRECT", lastAssignedIdx: 0,
});

describe("area rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("an area rule fires for its area only", async () => {
    db.assignmentRule.findMany.mockResolvedValue([rule([{ field: "area", operator: "equals", value: "HOSA_ROAD" }])]);
    expect(await evaluateAssignmentRules({ area: "HOSA_ROAD" })).toBe("nayana");
    expect(await evaluateAssignmentRules({ area: "BELLANDUR" })).toBeNull();
    expect(await evaluateAssignmentRules({ area: "" })).toBeNull();
  });

  it("'In' with one saved value is that value, not 'match everything'", async () => {
    db.assignmentRule.findMany.mockResolvedValue([rule([{ field: "area", operator: "in", value: "INDIRANAGAR" }])]);
    expect(await evaluateAssignmentRules({ area: "INDIRANAGAR" })).toBe("nayana");
    expect(await evaluateAssignmentRules({ area: "HEBBAL" })).toBeNull();
  });

  it("a number comparison on a non-number never matches", async () => {
    db.assignmentRule.findMany.mockResolvedValue([rule([{ field: "area", operator: "gt", value: "INDIRANAGAR" }])]);
    expect(await evaluateAssignmentRules({ area: "HEBBAL" })).toBeNull();
  });

  it("onlyField skips team routing and rules that don't test the area", async () => {
    db.assignmentRule.findMany.mockResolvedValue([
      rule([{ field: "source", operator: "equals", value: "WEBSITE" }], "sourceRep"),
      rule([{ field: "area", operator: "equals", value: "HOSA_ROAD" }]),
    ]);
    expect(await evaluateAssignmentRules({ source: "WEBSITE", eventType: "Wedding", area: "HOSA_ROAD" }, { onlyField: "area" })).toBe("nayana");
    expect(m.team).not.toHaveBeenCalled();
  });
});
