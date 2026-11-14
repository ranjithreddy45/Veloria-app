// ============================================================
// One-off move of in-flight reimbursement claims to the 2026-11-14 flow:
// Employee → Meghana N approves → Finance pays. Pure; used by
// scripts/reimb-meghana-only.ts, which reads and writes the database.
// ------------------------------------------------------------
// Owner decisions (2026-11-14):
//   • Meghana's approval is the only one needed before Finance. A claim that
//     already carries her approval goes straight to Finance ("Approved –
//     Pending Payment"); the stages after hers (Venkat, Finance approval) are
//     dropped as no longer required.
//   • Any other in-flight claim — waiting on Venkat, Dilkash, Nickson, Finance
//     or Meghana herself — ends with a single stage for Meghana.
//   • Past approvals are never touched: every decided stage is kept exactly as
//     recorded (who, when, note, label). Only stages nobody has decided yet
//     are replaced.
// ============================================================

import { MAX_STAGES, stageLabel, statusForStage, stageForStatus, type ChainStage } from "./claim-chain";

export type ClaimMove =
  | {
      kind: "TO_FINANCE";
      chain: ChainStage[];
      stageIndex: number;
      /** Meghana's existing approval — becomes the claim's final decision. */
      decidedById: string;
      decidedAt: string;
      /** Holders of the stages no longer required, for the trail note. */
      dropped: string[];
    }
  | { kind: "TO_MEGHANA"; chain: ChainStage[]; stageIndex: number; status: string; dropped: string[] }
  | { kind: "SKIP"; reason: string };

const holder = (st: ChainStage) => st.approverNames.join(" / ") || st.role;

export function planClaimMove(
  claim: { status: string; chain: ChainStage[] | null; claimantUserId: string | null },
  meghana: { id: string; name: string },
): ClaimMove {
  if (stageForStatus(claim.status) == null) return { kind: "SKIP", reason: `not awaiting approval (${claim.status})` };
  if (!claim.chain || claim.chain.length === 0) {
    return { kind: "SKIP", reason: "no route yet — gets the new default route (Meghana) the first time it is opened" };
  }
  // Decided stages are always the leading ones: a chain is approved in order.
  const decided = claim.chain.filter((st) => st.decidedAt);
  const open = claim.chain.slice(decided.length);

  const hers = decided.find((st) => st.decidedById === meghana.id);
  if (hers) {
    return {
      kind: "TO_FINANCE",
      chain: decided,
      stageIndex: decided.length - 1,
      decidedById: meghana.id,
      decidedAt: hers.decidedAt as string,
      dropped: open.map(holder),
    };
  }

  if (claim.claimantUserId === meghana.id) return { kind: "SKIP", reason: "Meghana's own claim — she can't approve it" };
  if (decided.length >= MAX_STAGES) return { kind: "SKIP", reason: "no room for another stage" };

  const total = decided.length + 1;
  const stage: ChainStage = {
    type: "USER",
    label: stageLabel(decided.length, total),
    role: meghana.name,
    approverIds: [meghana.id],
    approverNames: [meghana.name],
    fallback: false,
  };
  return {
    kind: "TO_MEGHANA",
    chain: [...decided, stage],
    stageIndex: decided.length,
    status: statusForStage(decided.length),
    dropped: open.filter((st) => !(st.approverIds.length === 1 && st.approverIds[0] === meghana.id)).map(holder),
  };
}
