// ============================================================
// BD unified pipeline — one funnel across AcqLead + AcqDeal.
// ------------------------------------------------------------
// The team's funnel (contacted → qualified → site visit → proposal →
// negotiation → agreement signed → won / on hold / lost) spans TWO records:
// early stages live on the lead, later ones on the deal it converts into.
// This module gives every lead ONE derived pipeline stage, a Prisma where
// fragment per stage (so the list can filter server-side, past the row cap),
// and the display metadata — all from a single source of truth.
// ============================================================

export type BdPipelineStageKey =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "SITE_VISIT"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "SIGNED"
  | "WON"
  | "ON_HOLD"
  | "LOST";

export type BdPipelineHue =
  | "slate"
  | "blue"
  | "cyan"
  | "violet"
  | "indigo"
  | "amber"
  | "teal"
  | "emerald"
  | "orange"
  | "red";

export const BD_PIPELINE_STAGES: { key: BdPipelineStageKey; label: string; hue: BdPipelineHue }[] = [
  { key: "NEW", label: "New", hue: "slate" },
  { key: "CONTACTED", label: "Contacted", hue: "blue" },
  { key: "QUALIFIED", label: "Qualified", hue: "cyan" },
  { key: "SITE_VISIT", label: "Site Visit / Evaluation", hue: "violet" },
  { key: "PROPOSAL_SENT", label: "Proposal Sent", hue: "indigo" },
  { key: "NEGOTIATION", label: "Negotiation", hue: "amber" },
  { key: "SIGNED", label: "Agreement Signed", hue: "teal" },
  { key: "WON", label: "Won", hue: "emerald" },
  { key: "ON_HOLD", label: "On Hold", hue: "orange" },
  { key: "LOST", label: "Lost", hue: "red" },
];

export const BD_PIPELINE_KEYS = BD_PIPELINE_STAGES.map((s) => s.key);

export function bdStageMeta(key: string) {
  return BD_PIPELINE_STAGES.find((s) => s.key === key) ?? BD_PIPELINE_STAGES[0];
}

/**
 * Derive the unified stage from a lead row (with its deal's stage, if any).
 * Deal stage wins once a deal exists — the lead's own status stops moving at
 * DEAL_CREATED. Mapping notes:
 *  - EVALUATION / EVALUATION_COMPLETED → "Site Visit / Evaluation"
 *  - CONTRACT_SENT counts as Negotiation (sent ≠ signed)
 *  - lead DISQUALIFIED and deal LOST both land in Lost
 */
export function deriveBdPipelineStage(lead: {
  status: string;
  deal?: { stage: string } | null;
}): BdPipelineStageKey {
  const dealStage = lead.deal?.stage;
  if (dealStage) {
    switch (dealStage) {
      case "QUALIFIED":
        return "QUALIFIED";
      case "EVALUATION":
      case "EVALUATION_COMPLETED":
        return "SITE_VISIT";
      case "PROPOSAL_SENT":
        return "PROPOSAL_SENT";
      case "NEGOTIATION":
      case "CONTRACT_SENT":
        return "NEGOTIATION";
      case "SIGNED":
        return "SIGNED";
      case "WON":
        return "WON";
      case "ON_HOLD":
        return "ON_HOLD";
      case "LOST":
        return "LOST";
    }
  }
  switch (lead.status) {
    case "CONTACTED":
      return "CONTACTED";
    case "QUALIFIED":
    case "DEAL_CREATED":
      return "QUALIFIED";
    case "DISQUALIFIED":
      return "LOST";
    default:
      return "NEW";
  }
}

/** Prisma where fragment (AcqLeadWhereInput-shaped) selecting one unified stage. */
export function bdPipelineWhere(key: BdPipelineStageKey): Record<string, unknown> {
  switch (key) {
    case "NEW":
      return { status: "NEW", deal: { is: null } };
    case "CONTACTED":
      return { status: "CONTACTED", deal: { is: null } };
    case "QUALIFIED":
      return {
        OR: [
          { status: "QUALIFIED", deal: { is: null } },
          { deal: { is: { stage: "QUALIFIED" } } },
        ],
      };
    case "SITE_VISIT":
      return { deal: { is: { stage: { in: ["EVALUATION", "EVALUATION_COMPLETED"] } } } };
    case "PROPOSAL_SENT":
      return { deal: { is: { stage: "PROPOSAL_SENT" } } };
    case "NEGOTIATION":
      return { deal: { is: { stage: { in: ["NEGOTIATION", "CONTRACT_SENT"] } } } };
    case "SIGNED":
      return { deal: { is: { stage: "SIGNED" } } };
    case "WON":
      return { deal: { is: { stage: "WON" } } };
    case "ON_HOLD":
      return { deal: { is: { stage: "ON_HOLD" } } };
    case "LOST":
      return {
        OR: [{ status: "DISQUALIFIED" }, { deal: { is: { stage: "LOST" } } }],
      };
  }
}
