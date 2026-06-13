"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { nextEmpCode } from "@/lib/hr/constants";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

// The columns we accept (header names, case-insensitive, spaces/underscores ignored).
export const IMPORT_COLUMNS = [
  "firstName", "lastName", "workEmail", "personalEmail", "phone",
  "legalEntity", "businessVertical", "department", "designation",
  "employmentType", "dateOfJoining", "workLocation", "reportingManagerCode", "status",
] as const;

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];
const STATUSES = ["ACTIVE", "ONBOARDING", "ON_LEAVE", "EXITED", "SUSPENDED"];

export interface ImportRowInput {
  [key: string]: string | undefined;
}

export interface ImportRowResult {
  index: number;
  ok: boolean;
  name: string;
  errors: string[];
  warnings: string[];
}

export interface ImportPreview {
  rows: ImportRowResult[];
  validCount: number;
  invalidCount: number;
}

function norm(s: string | undefined) {
  return (s ?? "").trim();
}
function key(s: string) {
  return s.toLowerCase().replace(/[\s_]/g, "");
}

// Build a header-normalised accessor for a row.
function pick(row: ImportRowInput, col: string): string {
  const want = key(col);
  for (const [k, v] of Object.entries(row)) {
    if (key(k) === want) return norm(v);
  }
  return "";
}

interface Lookups {
  entities: Map<string, string>;
  verticals: Map<string, string>;
  departments: Map<string, string>;
  designations: Map<string, string>;
  managersByCode: Map<string, string>;
  existingEmails: Set<string>;
}

async function loadLookups(): Promise<Lookups> {
  const [entities, verticals, departments, designations, employees] = await Promise.all([
    prisma.legalEntity.findMany({ where: { isActive: true }, select: { id: true, name: true, shortCode: true } }),
    prisma.businessVertical.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.hrDesignation.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.employee.findMany({ where: { deletedAt: null }, select: { id: true, empCode: true, workEmail: true } }),
  ]);
  const entityMap = new Map<string, string>();
  entities.forEach((e) => {
    entityMap.set(key(e.name), e.id);
    if (e.shortCode) entityMap.set(key(e.shortCode), e.id);
  });
  return {
    entities: entityMap,
    verticals: new Map(verticals.map((v) => [key(v.name), v.id])),
    departments: new Map(departments.map((d) => [key(d.name), d.id])),
    designations: new Map(designations.map((d) => [key(d.name), d.id])),
    managersByCode: new Map(employees.filter((e) => e.empCode).map((e) => [key(e.empCode), e.id])),
    existingEmails: new Set(employees.filter((e) => e.workEmail).map((e) => e.workEmail!.toLowerCase())),
  };
}

interface ResolvedRow {
  data: Prisma.EmployeeUncheckedCreateInput;
  result: ImportRowResult;
}

function resolveRow(row: ImportRowInput, index: number, lk: Lookups, seenEmails: Set<string>): ResolvedRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const firstName = pick(row, "firstName");
  const lastName = pick(row, "lastName");
  const name = `${firstName} ${lastName}`.trim() || `Row ${index + 1}`;
  if (!firstName) errors.push("First name is required.");
  if (!lastName) errors.push("Last name is required.");

  const entityRaw = pick(row, "legalEntity");
  const legalEntityId = entityRaw ? lk.entities.get(key(entityRaw)) : undefined;
  if (!entityRaw) errors.push("Legal entity is required.");
  else if (!legalEntityId) errors.push(`Legal entity "${entityRaw}" not found.`);

  const verticalRaw = pick(row, "businessVertical");
  let businessVerticalId: string | undefined;
  if (verticalRaw) {
    businessVerticalId = lk.verticals.get(key(verticalRaw));
    if (!businessVerticalId) warnings.push(`Vertical "${verticalRaw}" not found — left blank.`);
  }

  const deptRaw = pick(row, "department");
  let departmentId: string | undefined;
  if (deptRaw) {
    departmentId = lk.departments.get(key(deptRaw));
    if (!departmentId) warnings.push(`Department "${deptRaw}" not found — left blank.`);
  }

  const desigRaw = pick(row, "designation");
  let designationId: string | undefined;
  if (desigRaw) {
    designationId = lk.designations.get(key(desigRaw));
    if (!designationId) warnings.push(`Designation "${desigRaw}" not found — left blank.`);
  }

  const mgrRaw = pick(row, "reportingManagerCode");
  let reportingManagerId: string | undefined;
  if (mgrRaw) {
    reportingManagerId = lk.managersByCode.get(key(mgrRaw));
    if (!reportingManagerId) warnings.push(`Manager code "${mgrRaw}" not found — left blank.`);
  }

  const empType = pick(row, "employmentType").toUpperCase().replace(/[\s-]/g, "_");
  const employmentType = EMPLOYMENT_TYPES.includes(empType) ? empType : "FULL_TIME";
  if (pick(row, "employmentType") && !EMPLOYMENT_TYPES.includes(empType))
    warnings.push(`Unknown employment type — defaulted to Full-time.`);

  const statusRaw = pick(row, "status").toUpperCase().replace(/[\s-]/g, "_");
  const status = STATUSES.includes(statusRaw) ? statusRaw : "ONBOARDING";

  const workEmail = pick(row, "workEmail");
  if (workEmail) {
    const lc = workEmail.toLowerCase();
    if (lk.existingEmails.has(lc)) errors.push(`Work email "${workEmail}" already exists.`);
    else if (seenEmails.has(lc)) errors.push(`Work email "${workEmail}" is duplicated in this file.`);
    else seenEmails.add(lc);
  }

  const doj = pick(row, "dateOfJoining");
  let dateOfJoining: Date | undefined;
  if (doj) {
    const d = new Date(doj);
    if (isNaN(d.getTime())) warnings.push(`Couldn't parse joining date "${doj}".`);
    else dateOfJoining = d;
  }

  return {
    data: {
      empCode: "", // assigned at commit time
      firstName, lastName,
      workEmail: workEmail || null,
      personalEmail: pick(row, "personalEmail") || null,
      phone: pick(row, "phone") || null,
      legalEntityId: legalEntityId ?? "",
      businessVerticalId: businessVerticalId ?? null,
      departmentId: departmentId ?? null,
      designationId: designationId ?? null,
      employmentType: employmentType as Prisma.EmployeeUncheckedCreateInput["employmentType"],
      dateOfJoining: dateOfJoining ?? null,
      workLocation: pick(row, "workLocation") || null,
      reportingManagerId: reportingManagerId ?? null,
      status: status as Prisma.EmployeeUncheckedCreateInput["status"],
    },
    result: { index, ok: errors.length === 0, name, errors, warnings },
  };
}

// Dry-run preview — validates without writing.
export async function previewImport(rows: ImportRowInput[]): Promise<ImportPreview> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { rows: [], validCount: 0, invalidCount: 0 };
  if (rows.length === 0) return { rows: [], validCount: 0, invalidCount: 0 };
  if (rows.length > 1000) return { rows: [{ index: 0, ok: false, name: "—", errors: ["Limit is 1000 rows per import."], warnings: [] }], validCount: 0, invalidCount: 1 };

  const lk = await loadLookups();
  const seenEmails = new Set<string>();
  const resolved = rows.map((r, i) => resolveRow(r, i, lk, seenEmails));
  const results = resolved.map((r) => r.result);
  return {
    rows: results,
    validCount: results.filter((r) => r.ok).length,
    invalidCount: results.filter((r) => !r.ok).length,
  };
}

// Commit — creates all valid rows; skips invalid ones. Returns counts.
export async function commitImport(rows: ImportRowInput[]): Promise<{ success: boolean; created: number; skipped: number; error?: string }> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, created: 0, skipped: 0, error: "Not authorized." };
  if (rows.length === 0) return { success: false, created: 0, skipped: 0, error: "Nothing to import." };
  if (rows.length > 1000) return { success: false, created: 0, skipped: 0, error: "Limit is 1000 rows per import." };

  const lk = await loadLookups();
  const seenEmails = new Set<string>();
  const resolved = rows.map((r, i) => resolveRow(r, i, lk, seenEmails)).filter((r) => r.result.ok);
  if (resolved.length === 0) return { success: false, created: 0, skipped: rows.length, error: "No valid rows to import." };

  // Allocate emp codes sequentially from the current max.
  const existing = await prisma.employee.findMany({ select: { empCode: true } });
  let codes = existing.map((e) => e.empCode);

  let created = 0;
  await prisma.$transaction(async (tx) => {
    for (const r of resolved) {
      const code = nextEmpCode(codes);
      codes = [...codes, code];
      const emp = await tx.employee.create({ data: { ...r.data, empCode: code } });
      await tx.activityLog.create({
        data: { action: "EMPLOYEE_IMPORTED", entityType: "EMPLOYEE", entityId: emp.id, userId: u!.id, changes: { empCode: code } },
      });
      created++;
    }
  }, { timeout: 30000 });

  revalidatePath("/people");
  return { success: true, created, skipped: rows.length - created };
}
