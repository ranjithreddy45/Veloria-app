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
  designationId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  /** Must be one of the whitelisted keys below; anything else falls back to the default order. */
  sortBy?: string;
  sortOrder?: string; // "asc" | "desc"
}

// Whitelist of sortable columns. A client-supplied `sortBy` is ONLY ever used as
// a key into this map — a raw client string NEVER reaches Prisma's `orderBy`.
// (Kept module-local: a "use server" file may only export async functions.)
const EMPLOYEE_SORT_BUILDERS: Record<
  string,
  (dir: Prisma.SortOrder) => Prisma.EmployeeOrderByWithRelationInput[]
> = {
  name: (dir) => [{ firstName: dir }, { lastName: dir }],
  empCode: (dir) => [{ empCode: dir }],
  dateOfJoining: (dir) => [{ dateOfJoining: dir }],
  status: (dir) => [{ status: dir }],
  designation: (dir) => [{ designation: { name: dir } }],
};
const DEFAULT_EMPLOYEE_ORDER_BY: Prisma.EmployeeOrderByWithRelationInput[] = [
  { status: "asc" },
  { firstName: "asc" },
];

export async function getEmployees(filters: EmployeeFilters = {}) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return { rows: [], total: 0, page: 1, pageSize: 25 };

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));

  const where: Prisma.EmployeeWhereInput = { deletedAt: null };
  if (filters.legalEntityId) where.legalEntityId = filters.legalEntityId;
  if (filters.businessVerticalId) where.businessVerticalId = filters.businessVerticalId;
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.designationId) where.designationId = filters.designationId;
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

  // Resolve the sort strictly through the whitelist; fall back to the default.
  const sortDir: Prisma.SortOrder = filters.sortOrder === "desc" ? "desc" : "asc";
  const orderBy =
    filters.sortBy && EMPLOYEE_SORT_BUILDERS[filters.sortBy]
      ? EMPLOYEE_SORT_BUILDERS[filters.sortBy](sortDir)
      : DEFAULT_EMPLOYEE_ORDER_BY;

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
      orderBy,
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
  photoUrl?: string;
  legalEntityId: string;
  businessVerticalId?: string;
  departmentId?: string;
  designationId?: string;
  employmentType?: string;
  dateOfJoining?: string;
  workLocation?: string;
  siteId?: string; // assigned attendance site (geofence)
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

  // A reporting manager must be an existing, non-archived employee.
  if (input.reportingManagerId) {
    const mgr = await prisma.employee.findFirst({ where: { id: input.reportingManagerId, deletedAt: null }, select: { id: true } });
    if (!mgr) return { success: false, error: "Selected reporting manager is not a valid active employee." };
  }

  // The assigned attendance site must exist and be active.
  if (input.siteId) {
    const site = await prisma.attendanceSite.findFirst({ where: { id: input.siteId, isActive: true }, select: { id: true } });
    if (!site) return { success: false, error: "Selected attendance site no longer exists (or is inactive)." };
  }

  // Reject a duplicate work email (the field isn't DB-unique on legacy data).
  if (input.workEmail?.trim()) {
    const dupe = await prisma.employee.findFirst({ where: { workEmail: input.workEmail.trim(), deletedAt: null }, select: { id: true } });
    if (dupe) return { success: false, error: "An employee with that work email already exists." };
  }

  // Codes are zero-padded fixed width (e.g. PPG-0001), so the lexicographically
  // greatest empCode is also the numerically greatest. Fetch only the top few
  // (small bound covers any non-conforming legacy codes) instead of every row.
  const topCodes = await prisma.employee.findMany({
    select: { empCode: true },
    orderBy: { empCode: "desc" },
    take: 5,
  });
  const empCode = nextEmpCode(topCodes.map((e) => e.empCode));

  // Auto-link the login so self-service (attendance, leave, payslips, help desk)
  // can resolve "me → my employee record" — but only when it is SAFE to bind
  // SILENTLY: the actor holds hr:admin (the same gate the dedicated
  // linkEmployeeUser action requires, so an hr:write-only user can't bind an
  // arbitrary unclaimed login such as an exec's), the user is ACTIVE (a
  // deactivated/recycled email must never be silently bound), and the account
  // isn't already claimed. Otherwise leave it null — an admin links it explicitly.
  let autoUserId: string | null = null;
  if (input.workEmail?.trim() && can(u?.role, "hr:admin")) {
    const user = await prisma.user.findUnique({
      where: { email: input.workEmail.trim().toLowerCase() },
      select: { id: true, isActive: true },
    });
    if (user?.isActive) {
      const claimed = await prisma.employee.findFirst({ where: { userId: user.id }, select: { id: true } });
      if (!claimed) autoUserId = user.id;
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          empCode,
          userId: autoUserId,
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
          siteId: input.siteId || null,
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
      // Both empCode and userId are @unique — say which one actually collided.
      const target = String((err.meta as { target?: string | string[] } | undefined)?.target ?? "");
      if (target.includes("userId")) {
        return { success: false, error: "That work email's login was just linked to another employee. Create the employee without a work email, then link the login manually." };
      }
      return { success: false, error: "An employee with that code already exists. Please retry." };
    }
    return { success: false, error: "Could not create employee." };
  }
}

// ============================================================
// Login ↔ employee linkage.
// ------------------------------------------------------------
// `Employee.userId` is what every self-service resolver keys off
// (`employee.findFirst({ where: { userId } })` in attendance / leave / payslips
// / help desk / comp-off). Until it is set, an employee sees
// "Your account isn't linked to an employee record yet". These actions are the
// only supported way to establish or break that link.
// ============================================================

export interface LinkableUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

/** Active user accounts that are not already claimed by another employee.
 *  Pass the employee being edited so their own linked user stays selectable. */
export async function getLinkableUsers(employeeId?: string): Promise<LinkableUser[]> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return [];

  const claimed = await prisma.employee.findMany({
    where: { userId: { not: null }, ...(employeeId ? { id: { not: employeeId } } : {}) },
    select: { userId: true },
  });
  const taken = claimed.map((c) => c.userId!).filter(Boolean);

  const users = await prisma.user.findMany({
    where: { isActive: true, ...(taken.length ? { id: { notIn: taken } } : {}) },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { email: "asc" },
    take: 500,
  });
  return users.map((x) => ({ ...x, role: String(x.role) }));
}

/** Connect an employee record to a login. `Employee.userId` is @unique, so a
 *  user can back exactly one employee; a P2002 means someone claimed it first. */
export async function linkEmployeeUser(employeeId: string, userId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  if (!employeeId || !userId) return { success: false, error: "Pick an employee and a login." };

  const [emp, user] = await Promise.all([
    prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, email: true } }),
  ]);
  if (!emp) return { success: false, error: "Employee not found." };
  if (!user) return { success: false, error: "That login no longer exists." };
  if (!user.isActive) return { success: false, error: "That login is deactivated." };

  const claimed = await prisma.employee.findFirst({
    where: { userId, id: { not: employeeId } },
    select: { empCode: true, firstName: true, lastName: true },
  });
  if (claimed) {
    return {
      success: false,
      error: `That login is already linked to ${claimed.firstName} ${claimed.lastName} (${claimed.empCode}). Unlink it there first.`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id: employeeId }, data: { userId } });
      await hrAudit(tx, u!.id, { action: "EMPLOYEE_USER_LINKED", entityId: employeeId, changes: { userId, email: user.email } });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { success: false, error: "That login was just linked to another employee. Refresh and try again." };
    }
    return { success: false, error: "Could not link that login." };
  }

  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/people");
  return { success: true, data: { id: employeeId } };
}

/** Break the link. The employee immediately loses self-service access. */
export async function unlinkEmployeeUser(employeeId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  const emp = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { id: true, userId: true } });
  if (!emp) return { success: false, error: "Employee not found." };
  if (!emp.userId) return { success: false, error: "This employee has no linked login." };

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { userId: null } });
    await hrAudit(tx, u!.id, { action: "EMPLOYEE_USER_UNLINKED", entityId: employeeId, changes: { userId: emp.userId } });
  });

  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/people");
  return { success: true, data: { id: employeeId } };
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

  // A reporting manager must be an existing, non-archived employee.
  if (input.reportingManagerId) {
    const mgr = await prisma.employee.findFirst({ where: { id: input.reportingManagerId, deletedAt: null }, select: { id: true } });
    if (!mgr) return { success: false, error: "Selected reporting manager is not a valid active employee." };
  }

  // The assigned attendance site must exist and be active.
  if (input.siteId) {
    const site = await prisma.attendanceSite.findFirst({ where: { id: input.siteId, isActive: true }, select: { id: true } });
    if (!site) return { success: false, error: "Selected attendance site no longer exists (or is inactive)." };
  }

  // Reject a duplicate work email on another employee.
  if (input.workEmail?.trim()) {
    const dupe = await prisma.employee.findFirst({
      where: { workEmail: input.workEmail.trim(), deletedAt: null, id: { not: id } },
      select: { id: true },
    });
    if (dupe) return { success: false, error: "Another employee already uses that work email." };
  }

  // Validate FK existence before connecting (mirror createEmployee) so callers get
  // a clear message instead of an opaque P2025. Empty string => disconnect, skip check.
  if (input.legalEntityId) {
    const entity = await prisma.legalEntity.findUnique({ where: { id: input.legalEntityId }, select: { id: true } });
    if (!entity) return { success: false, error: "Selected legal entity no longer exists." };
  }
  if (input.businessVerticalId) {
    const vertical = await prisma.businessVertical.findUnique({ where: { id: input.businessVerticalId }, select: { id: true } });
    if (!vertical) return { success: false, error: "Selected business vertical no longer exists." };
  }
  if (input.departmentId) {
    const department = await prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } });
    if (!department) return { success: false, error: "Selected department no longer exists." };
  }
  if (input.designationId) {
    const designation = await prisma.hrDesignation.findUnique({ where: { id: input.designationId }, select: { id: true } });
    if (!designation) return { success: false, error: "Selected designation no longer exists." };
  }

  const data: Prisma.EmployeeUpdateInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName.trim();
  if (input.lastName !== undefined) data.lastName = input.lastName.trim();
  if (input.workEmail !== undefined) data.workEmail = input.workEmail?.trim() || null;
  if (input.personalEmail !== undefined) data.personalEmail = input.personalEmail?.trim() || null;
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.gender !== undefined) data.gender = input.gender || null;
  if (input.dob !== undefined) data.dob = input.dob ? new Date(input.dob) : null;
  if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl?.trim() || null;
  if (input.workLocation !== undefined) data.workLocation = input.workLocation?.trim() || null;
  if (input.siteId !== undefined) data.site = input.siteId ? { connect: { id: input.siteId } } : { disconnect: true };
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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data });
      await hrAudit(tx, u!.id, { action: "EMPLOYEE_UPDATED", entityId: id, changes: input as Prisma.InputJsonValue });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return { success: false, error: "Another employee already uses that work email." };
      // P2025: a connected related record (entity/vertical/department/designation/manager) no longer exists.
      if (err.code === "P2025") return { success: false, error: "A selected related record no longer exists. Please refresh and try again." };
    }
    return { success: false, error: "Could not update employee." };
  }
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
    // Unstrand pending approvals routed to this manager — clear the approver so
    // they fall to the HR queue (which sees all pending) instead of a dead user.
    await tx.leaveRequest.updateMany({ where: { approverId: id, status: "PENDING" }, data: { approverId: null } });
    await tx.regularization.updateMany({ where: { approverId: id, status: "PENDING" }, data: { approverId: null } });
    await hrAudit(tx, u!.id, { action: "EMPLOYEE_ARCHIVED", entityId: id, changes: { reason: reason || null } });
  });
  revalidatePath("/people");
  return { success: true, data: { id } };
}
