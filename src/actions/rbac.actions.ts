"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission, ALL_PERMISSIONS } from "@/lib/permissions";
import { EDITABLE_ROLES, getEffectivePermissions, isDefaultPermission } from "@/lib/rbac";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireManager() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || !role) return null;
  // Admins always qualify; any other role needs the explicit permission.
  const ok =
    role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role, "users:manage-roles");
  if (!ok) return null;
  return session.user as { id: string; role: string };
}

export interface RbacMatrix {
  roles: string[];
  permissions: string[];
  // role → set of currently-effective permissions
  effective: Record<string, string[]>;
}

export async function getRolePermissionMatrix(): Promise<Result<RbacMatrix>> {
  const user = await requireManager();
  if (!user) return { success: false, error: "Only an administrator can view role permissions." };

  const roles = [...EDITABLE_ROLES];
  const effective: Record<string, string[]> = {};
  for (const role of roles) {
    effective[role] = await getEffectivePermissions(role);
  }
  return {
    success: true,
    data: { roles, permissions: [...ALL_PERMISSIONS], effective },
  };
}

export async function setRolePermission(
  role: string,
  permission: string,
  granted: boolean
): Promise<Result<{ role: string; permission: string; granted: boolean }>> {
  const user = await requireManager();
  if (!user) return { success: false, error: "Only an administrator can change role permissions." };

  // Never editable: admin roles are always full-access; only the curated set is editable.
  if (!(EDITABLE_ROLES as readonly string[]).includes(role)) {
    return { success: false, error: "This role's access can't be edited." };
  }
  if (!ALL_PERMISSIONS.includes(permission as never)) {
    return { success: false, error: "Unknown permission." };
  }

  // If the choice matches the static default, drop any override (keeps it clean).
  if (granted === isDefaultPermission(role, permission)) {
    await prisma.rolePermission.deleteMany({ where: { role, permission } });
  } else {
    await prisma.rolePermission.upsert({
      where: { role_permission: { role, permission } },
      create: { role, permission, granted, updatedById: user.id },
      update: { granted, updatedById: user.id },
    });
  }
  revalidatePath("/settings/roles");
  return { success: true, data: { role, permission, granted } };
}
