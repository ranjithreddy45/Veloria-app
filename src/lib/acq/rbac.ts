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
    "SALES_EXEC",
    "SALES_HEAD",
  ]),
};

const SUPER_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

export function acqCan(role: string | null | undefined, action: AcqAction): boolean {
  if (!role) return false;
  if (SUPER_ROLES.has(role)) return true;
  return MATRIX[action]?.has(role) ?? false;
}

/** Any BD-CRM access at all (for nav visibility / page gating). */
export function acqHasAnyAccess(role: string | null | undefined): boolean {
  if (!role) return false;
  if (SUPER_ROLES.has(role)) return true;
  return [
    "BD_EXECUTIVE",
    "BD_HEAD",
    "OPERATIONS",
    "LEGAL",
    "SALES_EXEC",
    "SALES_HEAD",
    "PROJECTS_EXEC",
    "PROJECTS_HEAD",
  ].includes(role);
}
