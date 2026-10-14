import { describe, expect, it } from "vitest";
import {
  buildChain, parseChain, parseRouteStages, pickRoute, stageForStatus, stageLabel, statusForStage,
  type RouteRow, type StageSpec,
} from "./claim-chain";

const P = (id: string, name: string) => ({ id, name, email: `${id}@x.in` });
const meghana = P("u-meghana", "Meghana");
const venkat = P("u-venkat", "Venkat");
const amrutha = P("u-amrutha", "Amrutha");
const ranjith = P("u-ranjith", "Ranjith");
const dilkash = P("u-dilkash", "Dilkash");

const routes: RouteRow[] = [
  { kind: "EMPLOYEE", subjectEmployeeId: "e-dilkash", stages: [{ type: "USER", userId: "u-meghana" }, { type: "USER", userId: "u-venkat" }, { type: "FINANCE" }] },
  { kind: "EMPLOYEE", subjectEmployeeId: "e-amrutha", stages: [{ type: "USER", userId: "u-meghana" }, { type: "USER", userId: "u-venkat" }, { type: "FINANCE" }] },
  { kind: "TEAM", subjectEmployeeId: "e-dilkash", stages: [{ type: "MANAGER" }, { type: "USER", userId: "u-meghana" }, { type: "USER", userId: "u-venkat" }, { type: "FINANCE" }] },
];

describe("pickRoute", () => {
  it("a named person's own route wins, even though they also manage a team", () => {
    expect(pickRoute(routes, { id: "e-dilkash", reportingManagerId: "e-ranjith" })?.kind).toBe("EMPLOYEE");
  });
  it("a reportee follows their manager's team route", () => {
    const r = pickRoute(routes, { id: "e-aravind", reportingManagerId: "e-dilkash" });
    expect(r?.kind).toBe("TEAM");
    expect(r?.stages.map((s) => s.type)).toEqual(["MANAGER", "USER", "USER", "FINANCE"]);
  });
  it("anyone else gets no route (the default rules apply)", () => {
    expect(pickRoute(routes, { id: "e-x", reportingManagerId: "e-ranjith" })).toBeNull();
    expect(pickRoute(routes, { id: "e-x", reportingManagerId: null })).toBeNull();
  });
});

describe("buildChain", () => {
  const supers = [venkat, ranjith];
  it("builds the four-stage team chain with the manager first and Finance last", () => {
    const specs: StageSpec[] = [
      { type: "MANAGER", role: "Reporting manager", candidates: [dilkash] },
      { type: "USER", role: "HR", candidates: [meghana] },
      { type: "USER", role: "Venkat", candidates: [venkat] },
      { type: "FINANCE", role: "Finance", candidates: [amrutha] },
    ];
    const c = buildChain(specs, { claimantUserId: "u-aravind", superAdmins: supers });
    expect(c.map((s) => s.label)).toEqual(["1st approval", "2nd approval", "3rd approval", "Final approval"]);
    expect(c.map((s) => s.approverNames[0])).toEqual(["Dilkash", "Meghana", "Venkat", "Amrutha"]);
    expect(c.some((s) => s.fallback)).toBe(false);
  });

  it("never lets Amrutha give the final approval on her own claim", () => {
    const specs: StageSpec[] = [
      { type: "USER", role: "HR", candidates: [meghana] },
      { type: "USER", role: "Venkat", candidates: [venkat] },
      { type: "FINANCE", role: "Finance", candidates: [amrutha] },
    ];
    const c = buildChain(specs, { claimantUserId: "u-amrutha", superAdmins: supers });
    expect(c[2].approverIds).not.toContain("u-amrutha");
    // Venkat already holds the 2nd approval, so the fallback leaves him out.
    expect(c[2].approverNames).toEqual(["Ranjith"]);
    expect(c[2].fallback).toBe(true);
    expect(c[2].label).toBe("Final approval");
  });

  it("uses an approver from another stage only when no other Super Admin exists", () => {
    const specs: StageSpec[] = [
      { type: "USER", role: "Venkat", candidates: [venkat] },
      { type: "FINANCE", role: "Finance", candidates: [amrutha] },
    ];
    const c = buildChain(specs, { claimantUserId: "u-amrutha", superAdmins: [venkat] });
    expect(c[1].approverNames).toEqual(["Venkat"]);
  });

  it("routes a manager-less stage to the Super Admins rather than skipping it", () => {
    const c = buildChain([{ type: "MANAGER", role: "Reporting manager", candidates: [] }], { claimantUserId: "u-x", superAdmins: supers });
    expect(c[0].approverNames).toEqual(["Venkat", "Ranjith"]);
    expect(c[0].fallback).toBe(true);
  });

  it("keeps the claimant only when nobody else at all could approve", () => {
    const c = buildChain([{ type: "USER", role: "Admin", candidates: [ranjith] }], { claimantUserId: "u-ranjith", superAdmins: [ranjith] });
    expect(c[0].approverIds).toEqual(["u-ranjith"]);
  });

  it("caps a chain at four stages", () => {
    const five = Array.from({ length: 5 }, () => ({ type: "USER" as const, role: "x", candidates: [meghana] }));
    expect(buildChain(five, { claimantUserId: null, superAdmins: [] })).toHaveLength(4);
  });
});

describe("stages and statuses", () => {
  it("names the last stage Final and the rest by ordinal", () => {
    expect([0, 1, 2].map((i) => stageLabel(i, 3))).toEqual(["1st approval", "2nd approval", "Final approval"]);
    expect(stageLabel(0, 1)).toBe("Approval");
  });
  it("maps stage indexes to the claim statuses and back", () => {
    expect([0, 1, 2, 3].map(statusForStage)).toEqual(["PENDING", "PENDING_L2", "PENDING_L3", "PENDING_L4"]);
    expect(stageForStatus("PENDING_L4")).toBe(3);
    expect(stageForStatus("APPROVED")).toBeNull();
  });
  it("validates stored stages and chains", () => {
    expect(parseRouteStages([{ type: "MANAGER" }, { type: "USER" }, { type: "USER", userId: "u" }, { type: "BOGUS" }]))
      .toEqual([{ type: "MANAGER" }, { type: "USER", userId: "u" }]);
    expect(parseChain(null)).toBeNull();
    expect(parseChain([{ label: "1st approval", approverIds: ["a"], approverNames: ["A"] }])?.[0].approverIds).toEqual(["a"]);
  });
});
