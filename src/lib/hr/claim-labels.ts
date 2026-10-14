// ============================================================
// Reimbursement claim labels/constants — client-safe (no server imports).
// Server-side workflow helpers live in ./claim-workflow.ts.
// ============================================================

import type { Hue } from "@/components/shared/status-pill";

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting 1st approval",
  PENDING_L2: "Awaiting 2nd approval",
  PENDING_L3: "Awaiting final approval",
  NEEDS_INFO: "Sent back",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};

// Typed as StatusPill's Hue so an unsupported colour fails to compile. It was a
// free union that included "fuchsia", which StatusPill has no classes for:
// HUE_CLASSES["fuchsia"] is undefined and reading .bg threw, so every screen
// that drew a final-stage (PENDING_L3) claim as a pill crashed.
export const CLAIM_STATUS_HUE: Record<string, Hue> = {
  PENDING: "amber",
  PENDING_L2: "violet",
  PENDING_L3: "pink",
  NEEDS_INFO: "orange",
  APPROVED: "indigo",
  REJECTED: "rose",
  PAID: "emerald",
};

/** Human wording for each trail action (HrClaimEvent.action). */
export const CLAIM_EVENT_LABEL: Record<string, string> = {
  SUBMITTED: "Claim submitted",
  INFO_REQUESTED: "Sent back for more information",
  RESUBMITTED: "Resubmitted by employee",
  EDITED: "Attachments changed",
  LEVEL1_APPROVED: "1st-level approval",
  LEVEL2_APPROVED: "2nd-level approval",
  LEVEL3_APPROVED: "Final approval",
  LEVEL2_SKIPPED: "2nd-level approval not required",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAY_RUN_SCHEDULED: "Scheduled on a pay run",
  PAID: "Paid",
  WITHDRAWN: "Withdrawn by employee",
};

/** Statuses where an approver's decision is still outstanding. */
export const AWAITING_STATUSES = ["PENDING", "PENDING_L2", "PENDING_L3"] as const;
/** Statuses the employee may still edit or withdraw. */
export const EDITABLE_BY_EMPLOYEE = ["PENDING", "PENDING_L2", "PENDING_L3", "NEEDS_INFO"] as const;

/** Which approval level is currently waiting on a decision. */
export function awaitingLevel(status: string): 1 | 2 | 3 | null {
  if (status === "PENDING") return 1;
  if (status === "PENDING_L2") return 2;
  if (status === "PENDING_L3") return 3;
  return null;
}

/** The approval stage a level stands for, as people say it. */
export const CLAIM_STAGE_LABEL: Record<1 | 2 | 3, string> = {
  1: "1st approval",
  2: "2nd approval",
  3: "Final approval",
};
