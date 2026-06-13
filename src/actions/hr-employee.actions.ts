"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import {
  LEGAL_ENTITY_SEED,
  BUSINESS_VERTICAL_SEED,
  DEPARTMENT_SEED,
  DESIGNATION_SEED,
  nextEmpCode,
} from "@/lib/hr/constants";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// --- auth / permission helpers ----------------------------------------------
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

// Shared platform audit log (reuse ActivityLog — spec §6).
async function hrAudit(
  client: Prisma.TransactionClient | typeof prisma,
  userId: string,
  e: { action: string; entityId: string; changes?: unknown }
) {
  await client.activityLog.create({
    data: {
      action: e.action,
      entityType: "EMPLOYEE",
      entityId: e.entityId,
      changes: (e.changes ?? undefined) as Prisma.InputJsonValue | undefined,
      userId,
    },
  });
}

// ============================================================
// Lookups (entities, verticals, departments, designations, managers)
// ============================================================
export async function getHrLookups() {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) {
    return { entities: [], verticals: [], departments: [], designations: [], managers: [] };
  }
  const [entities, verticals, departments, designations, managers] = await Promise.all([
    prisma.legalEntity.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
    prisma.businessVertical.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.hrDesignation.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } },
      select: { id: true, firstName: true, lastName: true, empCode: true },
      orderBy: [{ firstName: "asc" }],
    }),
  ]);
  return { entities, verticals, departments, designations, managers };
}

// ============================================================
// Seed the org foundation (idempotent). Super Admin / HR Manager only.
// ============================================================
export async function seedHrFoundation(): Promise<Result<{ created: Record<string, number> }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  const created: Record<string, number> = { entities: 0, verticals: 0, departments: 0, designations: 0 };

  for (const e of LEGAL_ENTITY_SEED) {
    const exists = await prisma.legalEntity.findFirst({ where: { name: e.name } });
    if (!exists) {
      await prisma.legalEntity.create({ data: e });
      created.entities++;
    }
  }
  for (const v of BUSINESS_VERTICAL_SEED) {
    const exists = await prisma.businessVertical.findFirst({ where: { name: v.name } });
    if (!exists) {
      await prisma.businessVertical.create({ data: v });
      created.verticals++;
    }
  }
  for (const name of DEPARTMENT_SEED) {
    const exists = await prisma.department.findFirst({ where: { name } });
    if (!exists) {
      await prisma.department.create({ data: { name } });
      created.departments++;
    }
  }
  for (const name of DESIGNATION_SEED) {
    const exists = await prisma.hrDesignation.findFirst({ where: { name } });
    if (!exists) {
      await prisma.hrDesignation.create({ data: { name } });
      created.designations++;
    }
  }

  revalidatePath("/people");
  return { success: true, data: { created } };
}

// ============================================================
// Directory list (filterable, paginated, soft-delete aware)
// ============================================================
export interface EmployeeFilters {
  search?: string;
  legalEntityId?: string;
  businessVerticalId?: string;
  departmentId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function getEmployees(filters: EmployeeFilters = {}) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return { rows: [], total: 0, page: 1, pageSize: 25 };

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));

  const where: Prisma.EmployeeWhereInput = { deletedAt: null };
  if (filters.legalEntityId) where.legalEntityId = filters.legalEntityId;
  if (filters.businessVerticalId) where.businessVerticalId = filters.businessVerticalId;
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.status) where.status = filters.status as Prisma.EmployeeWhereInput["status"];
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { empCode: { contains: q, mode: "insensitive" } },
      { workEmail: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        legalEntity: { select: { name: true, shortCode: true } },
        businessVertical: { select: { name: true } },
        department: { select: { name: true } },
        designation: { select: { name: true } },
        reportingManager: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ status: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}

// KPI counts for the directory header.
export async function getEmployeeStats() {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;
  const [total, active, onboarding, onLeave, byEntity] = await Promise.all([
    prisma.employee.count({ where: { deletedAt: null } }),
    prisma.employee.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.employee.count({ where: { deletedAt: null, status: "ONBOARDING" } }),
    prisma.employee.count({ where: { deletedAt: null, status: "ON_LEAVE" } }),
    prisma.employee.groupBy({
      by: ["legalEntityId"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);
  return { total, active, onboarding, onLeave, entityCount: byEntity.length };
}

// ============================================================
// Org chart — flat node list (the UI builds the tree). Filterable
// by entity/vertical. This same reporting line drives approvals.
// ============================================================
export interface OrgNode {
  id: string;
  name: string;
  empCode: string;
  designation: string | null;
  department: string | null;
  entityShort: string | null;
  status: string;
  photoUrl: string | null;
  managerId: string | null;
}

export async function getOrgTree(filters: { legalEntityId?: string; businessVerticalId?: string } = {}) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [] as OrgNode[];

  const where: Prisma.EmployeeWhereInput = { deletedAt: null };
  if (filters.legalEntityId) where.legalEntityId = filters.legalEntityId;
  if (filters.businessVerticalId) where.businessVerticalId = filters.businessVerticalId;

  const emps = await prisma.employee.findMany({
    where,
    select: {
      id: true, firstName: true, lastName: true, empCode: true, status: true, photoUrl: true,
      reportingManagerId: true,
      designation: { select: { name: true } },
      department: { select: { name: true } },
      legalEntity: { select: { shortCode: true, name: true } },
    },
    orderBy: { firstName: "asc" },
  });

  return emps.map<OrgNode>((e) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`.trim(),
    empCode: e.empCode,
    designation: e.designation?.name ?? null,
    department: e.department?.name ?? null,
    entityShort: e.legalEntity?.shortCode ?? e.legalEntity?.name ?? null,
    status: e.status,
    photoUrl: e.photoUrl,
    managerId: e.reportingManagerId,
  }));
}

// ============================================================
// Single employee detail
// ============================================================
export async function getEmployee(id: string) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;
  const emp = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    include: {
      legalEntity: true,
      businessVertical: true,
      department: true,
      designation: true,
      reportingManager: { select: { id: true, firstName: true, lastName: true, empCode: true } },
      reports: {
        where: { deletedAt: null },
        select: { id: true, firstName: true, lastName: true, empCode: true, status: true },
        orderBy: { firstName: "asc" },
      },
      emergencyContacts: true,
      education: { orderBy: { year: "desc" } },
      workHistory: { orderBy: { fromDate: "desc" } },
      user: { select: { id: true, email: true, role: true, isActive: true } },
    },
  });
  return emp;
}

// ============================================================
// Create employee
// ============================================================
export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  workEmail?: string;
  personalEmail?: string;
  phone?: string;
  gender?: string;
  dob?: string; // ISO date
  legalEntityId: string;
  businessVerticalId?: string;
  departmentId?: string;
  designationId?: string;
  employmentType?: string;
  dateOfJoining?: string;
  workLocation?: string;
  reportingManagerId?: string;
  status?: string;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  if (!input.firstName?.trim() || !input.lastName?.trim())
    return { success: false, error: "First and last name are required." };
  if (!input.legalEntityId) return { success: false, error: "Legal entity is required." };

  // Validate FK existence to avoid opaque Prisma errors.
  const entity = await prisma.legalEntity.findUnique({ where: { id: input.legalEntityId } });
  if (!entity) return { success: false, error: "Selected legal entity no longer exists." };

  const existingCodes = await prisma.employee.findMany({ select: { empCode: true } });
  const empCode = nextEmpCode(existingCodes.map((e) => e.empCode));

  try {
    const created = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          empCode,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          workEmail: input.workEmail?.trim() || null,
          personalEmail: input.personalEmail?.trim() || null,
          phone: input.phone?.trim() || null,
          gender: input.gender || null,
          dob: input.dob ? new Date(input.dob) : null,
          legalEntityId: input.legalEntityId,
          businessVerticalId: input.businessVerticalId || null,
          departmentId: input.departmentId || null,
          designationId: input.designationId || null,
          employmentType: (input.employmentType as Prisma.EmployeeCreateInput["employmentType"]) || "FULL_TIME",
          dateOfJoining: input.dateOfJoining ? new Date(input.dateOfJoining) : null,
          workLocation: input.workLocation?.trim() || null,
          reportingManagerId: input.reportingManagerId || null,
          status: (input.status as Prisma.EmployeeCreateInput["status"]) || "ONBOARDING",
        },
      });
      await hrAudit(tx, u!.id, { action: "EMPLOYEE_CREATED", entityId: emp.id, changes: { empCode, name: `${emp.firstName} ${emp.lastName}` } });
      return emp;
    });
    revalidatePath("/people");
    return { success: true, data: { id: created.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { success: false, error: "An employee with that code already exists. Please retry." };
    }
    return { success: false, error: "Could not create employee." };
  }
}

// ============================================================
// Update employee (core fields; statutory handled in M2)
// ============================================================
export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };

  const existing = await prisma.employee.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { success: false, error: "Employee not found." };

  // Prevent an employee being set as their own reporting manager.
  if (input.reportingManagerId && input.reportingManagerId === id)
    return { success: false, error: "An employee cannot report to themselves." };

  const data: Prisma.EmployeeUpdateInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName.trim();
  if (input.lastName !== undefined) data.lastName = input.lastName.trim();
  if (input.workEmail !== undefined) data.workEmail = input.workEmail?.trim() || null;
  if (input.personalEmail !== undefined) data.personalEmail = input.personalEmail?.trim() || null;
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.gender !== undefined) data.gender = input.gender || null;
  if (input.dob !== undefined) data.dob = input.dob ? new Date(input.dob) : null;
  if (input.workLocation !== undefined) data.workLocation = input.workLocation?.trim() || null;
  if (input.dateOfJoining !== undefined) data.dateOfJoining = input.dateOfJoining ? new Date(input.dateOfJoining) : null;
  if (input.employmentType !== undefined) data.employmentType = input.employmentType as Prisma.EmployeeUpdateInput["employmentType"];
  if (input.status !== undefined) data.status = input.status as Prisma.EmployeeUpdateInput["status"];
  if (input.legalEntityId !== undefined) data.legalEntity = { connect: { id: input.legalEntityId } };
  if (input.businessVerticalId !== undefined)
    data.businessVertical = input.businessVerticalId ? { connect: { id: input.businessVerticalId } } : { disconnect: true };
  if (input.departmentId !== undefined)
    data.department = input.departmentId ? { connect: { id: input.departmentId } } : { disconnect: true };
  if (input.designationId !== undefined)
    data.designation = input.designationId ? { connect: { id: input.designationId } } : { disconnect: true };
  if (input.reportingManagerId !== undefined)
    data.reportingManager = input.reportingManagerId ? { connect: { id: input.reportingManagerId } } : { disconnect: true };

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id }, data });
    await hrAudit(tx, u!.id, { action: "EMPLOYEE_UPDATED", entityId: id, changes: input as Prisma.InputJsonValue });
  });
  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
  return { success: true, data: { id } };
}

// ============================================================
// Soft-delete (never hard-delete — spec §7). Marks EXITED + deletedAt.
// ============================================================
export async function archiveEmployee(id: string, reason?: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const existing = await prisma.employee.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { success: false, error: "Employee not found." };

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: "EXITED", dateOfExit: existing.dateOfExit ?? new Date() },
    });
    await hrAudit(tx, u!.id, { action: "EMPLOYEE_ARCHIVED", entityId: id, changes: { reason: reason || null } });
  });
  revalidatePath("/people");
  return { success: true, data: { id } };
}
