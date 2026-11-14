import { describe, expect, it } from "vitest";
import type { ChainStage } from "./claim-chain";
import { planClaimMove } from "./meghana-only-flow";

// The real in-flight shapes found in production on 2026-11-14.
const meghana = { id: "u-meghana", name: "Meghana" };
const st = (label: string, ids: string[], names: string[], decided?: { by: string; name: string; at: string }): ChainStage => ({
  type: "USER", label, role: names[0], approverIds: ids, approverNames: names, fallback: false,
  decidedById: decided?.by ?? null, decidedByName: decided?.name ?? null, decidedAt: decided?.at ?? null, note: null,
});
const dilkash = (d?: boolean) => st("1st approval", ["u-dilkash"], ["Dilkash Sheikh"], d ? { by: "u-dilkash", name: "Dilkash Sheikh", at: "2026-10-20T10:00:00.000Z" } : undefined);
const nickson = (d?: boolean) => st("1st approval", ["u-nickson"], ["Nickson"], d ? { by: "u-nickson", name: "Nickson", at: "2026-10-21T10:00:00.000Z" } : undefined);
const megh = (label: string, d?: boolean) => st(label, ["u-meghana"], ["Meghana"], d ? { by: "u-meghana", name: "Meghana", at: "2026-10-22T10:00:00.000Z" } : undefined);
const venkat = st("3rd approval", ["u-venkat"], ["Venkat"]);
const finance = { ...st("Final approval", ["u-amrutha"], ["Amrutha"]), type: "FINANCE" as const };

describe("planClaimMove", () => {
  it("waiting on Venkat after Meghana approved → straight to Finance, history kept", () => {
    const chain = [dilkash(true), megh("2nd approval", true), venkat, finance];
    const m = planClaimMove({ status: "PENDING_L3", chain, claimantUserId: "u-meera" }, meghana);
    expect(m.kind).toBe("TO_FINANCE");
    if (m.kind !== "TO_FINANCE") return;
    expect(m.chain).toEqual([chain[0], chain[1]]); // decided stages untouched, byte for byte
    expect(m.stageIndex).toBe(1);
    expect(m.decidedById).toBe("u-meghana");
    expect(m.decidedAt).toBe("2026-10-22T10:00:00.000Z");
    expect(m.dropped).toEqual(["Venkat", "Amrutha"]);
  });

  it("waiting on Amrutha's Finance approval after Meghana → straight to Finance", () => {
    const m = planClaimMove({ status: "PENDING_L2", chain: [megh("1st approval", true), finance], claimantUserId: "u-jaffer" }, meghana);
    expect(m).toMatchObject({ kind: "TO_FINANCE", stageIndex: 0, dropped: ["Amrutha"] });
  });

  it("waiting on Meghana after Nickson → stays with Meghana, now the final approval", () => {
    const m = planClaimMove({ status: "PENDING_L2", chain: [nickson(true), megh("2nd approval"), finance], claimantUserId: "u-srinivas" }, meghana);
    expect(m.kind).toBe("TO_MEGHANA");
    if (m.kind !== "TO_MEGHANA") return;
    expect(m.chain[0]).toEqual(nickson(true));
    expect(m.chain[1]).toMatchObject({ label: "Final approval", approverIds: ["u-meghana"] });
    expect(m.chain[1].decidedAt).toBeFalsy();
    expect(m.chain).toHaveLength(2);
    expect(m).toMatchObject({ stageIndex: 1, status: "PENDING_L2", dropped: ["Amrutha"] });
  });

  it("waiting on Dilkash (who has left) → moves to Meghana as the only approval", () => {
    const m = planClaimMove({ status: "PENDING", chain: [dilkash(), megh("2nd approval"), finance], claimantUserId: "u-nivetha" }, meghana);
    expect(m).toMatchObject({ kind: "TO_MEGHANA", stageIndex: 0, status: "PENDING", dropped: ["Dilkash Sheikh", "Amrutha"] });
    if (m.kind === "TO_MEGHANA") expect(m.chain).toEqual([expect.objectContaining({ label: "Approval", approverNames: ["Meghana"] })]);
  });

  it("waiting on Meghana with Amrutha after → Meghana only", () => {
    const m = planClaimMove({ status: "PENDING", chain: [megh("1st approval"), finance], claimantUserId: "u-aravind" }, meghana);
    expect(m).toMatchObject({ kind: "TO_MEGHANA", stageIndex: 0, status: "PENDING", dropped: ["Amrutha"] });
  });

  it("leaves alone what isn't awaiting approval, has no route, or is Meghana's own", () => {
    expect(planClaimMove({ status: "APPROVED", chain: [megh("Approval", true)], claimantUserId: "x" }, meghana).kind).toBe("SKIP");
    expect(planClaimMove({ status: "NEEDS_INFO", chain: [megh("Approval")], claimantUserId: "x" }, meghana).kind).toBe("SKIP");
    expect(planClaimMove({ status: "PENDING", chain: null, claimantUserId: "x" }, meghana).kind).toBe("SKIP");
    expect(planClaimMove({ status: "PENDING", chain: [venkat], claimantUserId: "u-meghana" }, meghana).kind).toBe("SKIP");
  });
});
