// ============================================================
// Who is staff, who is external, and where each role lands.
// ------------------------------------------------------------
// Edge-safe (no Prisma) so middleware can import it. One list instead of the
// copies that had drifted across the app: several checks treated "any role
// other than CLIENT/VENDOR" as staff, so a new external role (VENUE_OWNER)
// would silently have counted as staff in each of them. Prefer isStaffRole
// (an allowlist) over isExternalRole wherever a check guards staff data.
// ============================================================

/** Roles that may use the staff dashboard and internal CRM routes. */
export const INTERNAL_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "SALES_EXEC",
  "SALES_HEAD",
  "EVENT_COORDINATOR",
  "FINANCE",
  "STAFF",
  // BD / Acquisition CRM roles
  "BD_EXECUTIVE",
  "BD_HEAD",
  "OPERATIONS",
  "OPERATIONS_HEAD",
  "PROPERTY_MANAGER",
  "LEGAL",
  // Projects team
  "PROJECTS_EXEC",
  "PROJECTS_HEAD",
  // Design team
  "DESIGN_EXEC",
  "DESIGN_HEAD",
  // HR / People (shared identity)
  "HR_MANAGER",
  "HR_EXECUTIVE",
  "AUDITOR",
  "MARKETING",
] as const;

/** Logins that belong to people outside the company: customers, vendors, venue owners. */
export const EXTERNAL_ROLES = ["CLIENT", "VENDOR", "VENUE_OWNER"] as const;

/** Staff by allowlist — an unknown or missing role is never staff. */
export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && (INTERNAL_ROLES as readonly string[]).includes(role);
}

export function isExternalRole(role: string | null | undefined): boolean {
  return !!role && (EXTERNAL_ROLES as readonly string[]).includes(role);
}

/** Where a signed-in user of this role belongs. */
export function homeForRole(role: string | null | undefined): string {
  if (role === "CLIENT") return "/portal";
  if (role === "VENDOR") return "/vendor-portal";
  if (role === "VENUE_OWNER") return "/venue-portal";
  return "/dashboard";
}
