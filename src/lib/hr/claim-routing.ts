// ============================================================
// Reimbursement approval routing — the pure rule selection.
// Client-safe (no server imports) so it can be unit-tested and shared.
//
// Rules live in HrReimbursementApprover as (level, scope, userId):
//   scope "ALL"            the company-wide default for that level
//   scope "CATEGORY_EVENT" level 1 only: event expenses go to a named pool
//   scope <departmentId>   level 2 only: the employee's department approver
//   scope "EMP:<id>"       a route for ONE employee, at any level 1–3
//
// A per-employee route wins over everything else at its level, so a named
// person can follow a fixed chain (e.g. Venkat → Meghana → Amrutha) while the
// rest of the company keeps the default routing.
// ============================================================

export type ApproverRuleRow = { level: number; scope: string; userId: string };

export const EMPLOYEE_ROUTE_PREFIX = "EMP:";

export function employeeRouteScope(employeeId: string): string {
  return `${EMPLOYEE_ROUTE_PREFIX}${employeeId}`;
}

export function isEmployeeRouteScope(scope: string): boolean {
  return scope.startsWith(EMPLOYEE_ROUTE_PREFIX);
}

export function employeeIdFromScope(scope: string): string | null {
  return isEmployeeRouteScope(scope) ? scope.slice(EMPLOYEE_ROUTE_PREFIX.length) : null;
}

export interface PickedRules {
  /** First-level rule, or null (the caller falls back to Super Admins). */
  l1: ApproverRuleRow | null;
  /** Second-level rule, or null (second level is skipped). */
  l2: ApproverRuleRow | null;
  /** A per-employee final-approval rule, or null (the caller uses Finance). */
  l3: ApproverRuleRow | null;
  /** True when any level came from a per-employee route. */
  employeeRouted: boolean;
}

export function pickApproverRules(
  rules: ApproverRuleRow[],
  employee: { id?: string | null; departmentId: string | null },
  category?: string | null,
): PickedRules {
  const emp = employee.id ? employeeRouteScope(employee.id) : null;
  const find = (level: number, scope: string | null | undefined) =>
    scope ? rules.find((r) => r.level === level && r.scope === scope) ?? null : null;

  const l1Emp = find(1, emp);
  const l2Emp = find(2, emp);
  const l3Emp = find(3, emp);

  const l1 =
    l1Emp ??
    (String(category ?? "").toUpperCase() === "EVENT" ? find(1, "CATEGORY_EVENT") : null) ??
    find(1, "ALL");
  const l2 = l2Emp ?? find(2, employee.departmentId) ?? find(2, "ALL");

  return { l1, l2, l3: l3Emp, employeeRouted: !!(l1Emp || l2Emp || l3Emp) };
}
