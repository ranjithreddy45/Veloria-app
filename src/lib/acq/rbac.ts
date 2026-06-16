// ============================================================
// BD / Acquisition CRM — role matrix (spec §7.3), server-enforced.
// ============================================================

export type AcqAction =
  | "lead:write" // create/edit Lead, Deal
  | "lead:delete" // delete a lead — BD Head only
  | "lead:reassign" // change lead ownership — manager only
  | "deal:transition"
  | "bdhead:approve"
  | "legal:review"
  | "onboarding:complete"
  | "property:available"
  | "inventory:view";

// Role → allowed actions. SUPER_ADMIN and ADMIN get everything.
const MATRIX: Record<AcqAction, ReadonlySet<string>> = {
  "lead:write": new Set(["BD_EXECUTIVE", "BD_HEAD"]),
  "lead:delete": new Set(["BD_HEAD"]), // BD team cannot delete; BD Head + admins only
  "lead:reassign": new Set(["BD_HEAD"]), // manager-only ownership change
  "deal:transition": new Set(["BD_EXECUTIVE", "BD_HEAD"]),
  "bdhead:approve": new Set(["BD_HEAD"]),
  "legal:review": new Set(["BD_HEAD", "LEGAL"]),
  "onboarding:complete": new Set(["OPERATIONS"]),
  "property:available": new Set(["BD_HEAD", "OPERATIONS"]),
  "inventory:view": new Set([
    "BD_EXECUTIVE",
    "BD_HEAD",
    "OPERATIONS",
  ]),
};

const SUPER_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

// Human-readable labels for the BD actions (for the read-only Settings view).
export const ACQ_ACTION_LABELS: Record<AcqAction, string> = {
  "lead:write": "Create / edit BD leads & deals",
  "lead:delete": "Delete BD leads",
  "lead:reassign": "Reassign lead ownership",
  "deal:transition": "Move deals through stages",
  "bdhead:approve": "BD Head approvals",
  "legal:review": "Legal contract review",
  "onboarding:complete": "Complete venue onboarding",
  "property:available": "Publish property as bookable",
  "inventory:view": "View venue inventory",
};

// Read-only snapshot of the BD/Acquisition matrix for display in Settings.
// (BD permissions are code-managed via the MATRIX above, not DB-editable.)
// SUPER_ADMIN / ADMIN implicitly have everything.
export function acqMatrixForDisplay(): { action: AcqAction; label: string; roles: string[] }[] {
  return (Object.keys(MATRIX) as AcqAction[]).map((action) => ({
    action,
    label: ACQ_ACTION_LABELS[action],
    roles: [...MATRIX[action]].sort(),
  }));
}

export function acqCan(role: string | null | undefined, action: AcqAction): boolean {
  if (!role) return false;
  if (SUPER_ROLES.has(role)) return true;
  return MATRIX[action]?.has(role) ?? false;
}

/** Any BD-CRM access at all (for nav visibility / page gating). */
export function acqHasAnyAccess(role: string | null | undefined): boolean {
  if (!role) return false;
  if (SUPER_ROLES.has(role)) return true;
  // Sales roles are intentionally excluded: Sales CRM (customer sales) and BD
  // CRM (venue acquisition) are separate pipelines. The BD nav + /bd routes gate
  // on owners:read, which Sales roles don't hold — listing them here only
  // created drift between the two RBAC systems.
  return [
    "BD_EXECUTIVE",
    "BD_HEAD",
    "OPERATIONS",
    "LEGAL",
    "PROJECTS_EXEC",
    "PROJECTS_HEAD",
  ].includes(role);
}
