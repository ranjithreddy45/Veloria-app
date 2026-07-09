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

// ============================================================
// Organisation master-data (Departments / Designations /
// Legal Entities / Business Verticals) — admin CRUD.
// ============================================================

export interface OrgConfigListItem {
  id: string;
  name: string;
  isActive: boolean;
  order?: number;
  shortCode?: string | null;
  isIncorporated?: boolean;
  employeeCount: number;
}

export interface OrgConfig {
  departments: OrgConfigListItem[];
  designations: OrgConfigListItem[];
  legalEntities: OrgConfigListItem[];
  businessVerticals: OrgConfigListItem[];
}

const EMPTY_ORG_CONFIG: OrgConfig = {
  departments: [],
  designations: [],
  legalEntities: [],
  businessVerticals: [],
};

export async function listOrgConfig(): Promise<OrgConfig> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return EMPTY_ORG_CONFIG;

  const [departments, designations, legalEntities, businessVerticals] = await Promise.all([
    prisma.department.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true, _count: { select: { employees: true } } },
    }),
    prisma.hrDesignation.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true, _count: { select: { employees: true } } },
    }),
    prisma.legalEntity.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, shortCode: true, isIncorporated: true, isActive: true, order: true,
        _count: { select: { employees: true } },
      },
    }),
    prisma.businessVertical.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true, order: true, _count: { select: { employees: true } } },
    }),
  ]);

  return {
    departments: departments.map((d) => ({ id: d.id, name: d.name, isActive: d.isActive, employeeCount: d._count.employees })),
    designations: designations.map((d) => ({ id: d.id, name: d.name, isActive: d.isActive, employeeCount: d._count.employees })),
    legalEntities: legalEntities.map((e) => ({
      id: e.id, name: e.name, isActive: e.isActive, order: e.order,
      shortCode: e.shortCode, isIncorporated: e.isIncorporated, employeeCount: e._count.employees,
    })),
    businessVerticals: businessVerticals.map((v) => ({
      id: v.id, name: v.name, isActive: v.isActive, order: v.order, employeeCount: v._count.employees,
    })),
  };
}

// Case-insensitive duplicate-name filter, excluding the row being edited.
function dupWhere(name: string, excludeId?: string) {
  return {
    name: { equals: name, mode: "insensitive" as const },
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };
}

// ---- Departments -------------------------------------------------
export interface DepartmentInput { id?: string; name: string; isActive?: boolean }

export async function upsertDepartment(input: DepartmentInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const name = input.name?.trim();
  if (!name) return { success: false, error: "Name is required." };
  try {
    if (await prisma.department.findFirst({ where: dupWhere(name, input.id), select: { id: true } }))
      return { success: false, error: "A department with this name already exists." };
    if (input.id) {
      await prisma.department.update({ where: { id: input.id }, data: { name, isActive: input.isActive ?? true } });
      revalidatePath("/people/settings");
      return { success: true, data: { id: input.id } };
    }
    const created = await prisma.department.create({ data: { name, isActive: input.isActive ?? true } });
    revalidatePath("/people/settings");
    return { success: true, data: { id: created.id } };
  } catch {
    return { success: false, error: "Could not save the department." };
  }
}

export async function deleteDepartment(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const count = await prisma.employee.count({ where: { departmentId: id } });
  if (count > 0)
    return { success: false, error: `Can't delete — ${count} employee${count === 1 ? " is" : "s are"} assigned to this department. Reassign them first, or set it inactive.` };
  try {
    await prisma.department.delete({ where: { id } });
    revalidatePath("/people/settings");
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not delete the department." };
  }
}

// ---- Designations ------------------------------------------------
export interface DesignationInput { id?: string; name: string; isActive?: boolean }

export async function upsertDesignation(input: DesignationInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const name = input.name?.trim();
  if (!name) return { success: false, error: "Name is required." };
  try {
    if (await prisma.hrDesignation.findFirst({ where: dupWhere(name, input.id), select: { id: true } }))
      return { success: false, error: "A designation with this name already exists." };
    if (input.id) {
      await prisma.hrDesignation.update({ where: { id: input.id }, data: { name, isActive: input.isActive ?? true } });
      revalidatePath("/people/settings");
      return { success: true, data: { id: input.id } };
    }
    const created = await prisma.hrDesignation.create({ data: { name, isActive: input.isActive ?? true } });
    revalidatePath("/people/settings");
    return { success: true, data: { id: created.id } };
  } catch {
    return { success: false, error: "Could not save the designation." };
  }
}

export async function deleteDesignation(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const count = await prisma.employee.count({ where: { designationId: id } });
  if (count > 0)
    return { success: false, error: `Can't delete — ${count} employee${count === 1 ? " holds" : "s hold"} this designation. Reassign them first, or set it inactive.` };
  try {
    await prisma.hrDesignation.delete({ where: { id } });
    revalidatePath("/people/settings");
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not delete the designation." };
  }
}

// ---- Legal Entities ----------------------------------------------
export interface LegalEntityInput {
  id?: string; name: string; shortCode?: string | null; isIncorporated?: boolean; isActive?: boolean; order?: number;
}

export async function upsertLegalEntity(input: LegalEntityInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const name = input.name?.trim();
  if (!name) return { success: false, error: "Name is required." };
  try {
    if (await prisma.legalEntity.findFirst({ where: dupWhere(name, input.id), select: { id: true } }))
      return { success: false, error: "A legal entity with this name already exists." };
    const data = {
      name,
      shortCode: input.shortCode?.trim() || null,
      isIncorporated: input.isIncorporated ?? true,
      isActive: input.isActive ?? true,
      order: input.order ?? 0,
    };
    if (input.id) {
      await prisma.legalEntity.update({ where: { id: input.id }, data });
      revalidatePath("/people/settings");
      return { success: true, data: { id: input.id } };
    }
    const created = await prisma.legalEntity.create({ data });
    revalidatePath("/people/settings");
    return { success: true, data: { id: created.id } };
  } catch {
    return { success: false, error: "Could not save the legal entity." };
  }
}

export async function deleteLegalEntity(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const count = await prisma.employee.count({ where: { legalEntityId: id } });
  if (count > 0)
    return { success: false, error: `Can't delete — ${count} employee${count === 1 ? " belongs" : "s belong"} to this legal entity. Reassign them first, or set it inactive.` };
  try {
    await prisma.legalEntity.delete({ where: { id } });
    revalidatePath("/people/settings");
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not delete the legal entity — it may still be referenced elsewhere." };
  }
}

// ---- Business Verticals ------------------------------------------
export interface BusinessVerticalInput { id?: string; name: string; isActive?: boolean; order?: number }

export async function upsertBusinessVertical(input: BusinessVerticalInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const name = input.name?.trim();
  if (!name) return { success: false, error: "Name is required." };
  try {
    if (await prisma.businessVertical.findFirst({ where: dupWhere(name, input.id), select: { id: true } }))
      return { success: false, error: "A business vertical with this name already exists." };
    const data = { name, isActive: input.isActive ?? true, order: input.order ?? 0 };
    if (input.id) {
      await prisma.businessVertical.update({ where: { id: input.id }, data });
      revalidatePath("/people/settings");
      return { success: true, data: { id: input.id } };
    }
    const created = await prisma.businessVertical.create({ data });
    revalidatePath("/people/settings");
    return { success: true, data: { id: created.id } };
  } catch {
    return { success: false, error: "Could not save the business vertical." };
  }
}

export async function deleteBusinessVertical(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const count = await prisma.employee.count({ where: { businessVerticalId: id } });
  if (count > 0)
    return { success: false, error: `Can't delete — ${count} employee${count === 1 ? " is" : "s are"} assigned to this business vertical. Reassign them first, or set it inactive.` };
  try {
    await prisma.businessVertical.delete({ where: { id } });
    revalidatePath("/people/settings");
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not delete the business vertical." };
  }
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
