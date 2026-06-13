"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

// ============================================================
// Custom field definitions (admin-configurable)
// ============================================================
export async function getCustomFieldDefs(activeOnly = false) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  return prisma.hrCustomFieldDef.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

function slugifyKey(label: string): string {
  return "cf_" + label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

export interface CustomFieldInput {
  id?: string;
  label: string;
  type: string;
  options?: string;
  required?: boolean;
  isActive?: boolean;
  order?: number;
}

export async function upsertCustomFieldDef(input: CustomFieldInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  if (!input.label?.trim()) return { success: false, error: "Label is required." };

  const type = ["TEXT", "NUMBER", "DATE", "SELECT", "BOOLEAN"].includes(input.type) ? input.type : "TEXT";
  if (type === "SELECT" && !input.options?.trim())
    return { success: false, error: "Choices are required for a dropdown field." };

  try {
    if (input.id) {
      await prisma.hrCustomFieldDef.update({
        where: { id: input.id },
        data: {
          label: input.label.trim(),
          type: type as Prisma.HrCustomFieldDefUpdateInput["type"],
          options: input.options?.trim() || null,
          required: !!input.required,
          isActive: input.isActive ?? true,
          order: input.order ?? 0,
        },
      });
      revalidatePath("/people/settings");
      return { success: true, data: { id: input.id } };
    }
    // New — generate a stable unique key.
    let baseKey = slugifyKey(input.label);
    let key = baseKey;
    let n = 1;
    while (await prisma.hrCustomFieldDef.findUnique({ where: { key } })) key = `${baseKey}_${n++}`;
    const created = await prisma.hrCustomFieldDef.create({
      data: {
        key,
        label: input.label.trim(),
        type: type as Prisma.HrCustomFieldDefCreateInput["type"],
        options: input.options?.trim() || null,
        required: !!input.required,
        order: input.order ?? 0,
      },
    });
    revalidatePath("/people/settings");
    return { success: true, data: { id: created.id } };
  } catch {
    return { success: false, error: "Could not save the field." };
  }
}

export async function deleteCustomFieldDef(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  // Soft-disable rather than hard-delete so existing values stay intact.
  await prisma.hrCustomFieldDef.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/people/settings");
  return { success: true, data: { id } };
}

// Set custom field values on an employee (merges into the JSON blob).
export async function setEmployeeCustomFields(employeeId: string, values: Record<string, unknown>): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { customFields: true } });
  if (!emp) return { success: false, error: "Employee not found." };
  const merged = { ...((emp.customFields as Record<string, unknown>) ?? {}), ...values };
  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { customFields: merged as Prisma.InputJsonValue } });
    await tx.activityLog.create({
      data: { action: "EMPLOYEE_CUSTOM_FIELDS_UPDATED", entityType: "EMPLOYEE", entityId: employeeId, userId: u!.id, changes: values as Prisma.InputJsonValue },
    });
  });
  revalidatePath(`/people/${employeeId}`);
  return { success: true, data: { id: employeeId } };
}
