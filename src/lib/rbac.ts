// ============================================================
// Effective permissions = static role defaults ± DB overrides.
// Node-only (reads Prisma). Used to bake perms into the JWT at sign-in
// and by the Roles & Permissions admin UI.
// ============================================================

import { prisma } from "@/lib/prisma";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

/** Roles whose access is editable in the UI (admins are always full-access). */
export const EDITABLE_ROLES = [
  "SALES_EXEC",
  "EVENT_COORDINATOR",
  "FINANCE",
  "STAFF",
  "BD_EXECUTIVE",
  "BD_HEAD",
  "OPERATIONS",
  "LEGAL",
  "PROJECTS_EXEC",
  "PROJECTS_HEAD",
] as const;

/** Resolve the effective permission list for a role (defaults ± overrides). */
export async function getEffectivePermissions(role: string): Promise<string[]> {
  const effective = new Set<string>(ROLE_PERMISSIONS[role] ?? []);
  try {
    const overrides = await prisma.rolePermission.findMany({ where: { role } });
    for (const o of overrides) {
      if (o.granted) effective.add(o.permission);
      else effective.delete(o.permission);
    }
  } catch {
    // Never break auth on a DB hiccup — fall back to static defaults.
  }
  return [...effective];
}

/** Whether the role's default (pre-override) grants this permission. */
export function isDefaultPermission(role: string, permission: string): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission as never);
}
