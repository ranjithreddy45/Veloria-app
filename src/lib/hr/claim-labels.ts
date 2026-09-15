// ============================================================
// Reimbursement claim labels/constants — client-safe (no server imports).
// Server-side workflow helpers live in ./claim-workflow.ts.
// ============================================================

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting 1st approval",
  PENDING_L2: "Awaiting 2nd approval",
  NEEDS_INFO: "Sent back",
  APPROVED: "Approved · with Finance",
  REJECTED: "Rejected",
  PAID: "Paid",
};

export const CLAIM_STATUS_HUE: Record<
  string,
  "amber" | "orange" | "indigo" | "rose" | "emerald" | "violet" | "slate"
> = {
  PENDING: "amber",
  PENDING_L2: "violet",
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
  LEVEL2_SKIPPED: "2nd-level approval not required",
  APPROVED: "Approved — sent to Finance",
  REJECTED: "Rejected",
  PAY_RUN_SCHEDULED: "Scheduled on a pay run",
  PAID: "Paid",
  WITHDRAWN: "Withdrawn by employee",
};

/** Statuses where an approver's decision is still outstanding. */
export const AWAITING_STATUSES = ["PENDING", "PENDING_L2"] as const;
/** Statuses the employee may still edit or withdraw. */
export const EDITABLE_BY_EMPLOYEE = ["PENDING", "PENDING_L2", "NEEDS_INFO"] as const;

/** Which approval level is currently waiting on a decision. */
export function awaitingLevel(status: string): 1 | 2 | null {
  if (status === "PENDING") return 1;
  if (status === "PENDING_L2") return 2;
  return null;
}
