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

// appliesTo is a free String on the model; keep the accepted set narrow.
const APPLIES_TO = ["ALL", "FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] as const;
function normalizeAppliesTo(v: string | undefined): string {
  return v && (APPLIES_TO as readonly string[]).includes(v) ? v : "ALL";
}

export interface RequiredDocTypeRow {
  id: string;
  name: string;
  appliesTo: string;
  mandatory: boolean;
  order: number;
  active: boolean;
}

// ============================================================
// Master data — the mandatory-document catalogue (hr:admin CRUD)
// ============================================================

export async function listRequiredDocTypes(): Promise<RequiredDocTypeRow[]> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  const rows = await prisma.hrRequiredDocType.findMany({
    orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, appliesTo: true, mandatory: true, order: true, active: true },
  });
  return rows;
}

export interface RequiredDocTypeInput {
  id?: string;
  name: string;
  appliesTo?: string;
  mandatory?: boolean;
  order?: number;
}

export async function upsertRequiredDocType(
  input: RequiredDocTypeInput
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const name = input.name?.trim();
  if (!name) return { success: false, error: "Document name is required." };

  const data = {
    name,
    appliesTo: normalizeAppliesTo(input.appliesTo),
    mandatory: input.mandatory ?? true,
    order: input.order ?? 0,
  };

  try {
    if (input.id) {
      await prisma.hrRequiredDocType.update({ where: { id: input.id }, data });
      revalidatePath("/people/settings/required-docs");
      return { success: true, data: { id: input.id } };
    }
    const created = await prisma.hrRequiredDocType.create({ data });
    revalidatePath("/people/settings/required-docs");
    return { success: true, data: { id: created.id } };
  } catch (err) {
    // @@unique([entityId, name]) — friendly message on collision.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { success: false, error: "A required document with this name already exists." };
    }
    return { success: false, error: "Could not save the document type." };
  }
}

export async function toggleRequiredDocType(id: string): Promise<Result<{ id: string; active: boolean }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const row = await prisma.hrRequiredDocType.findUnique({ where: { id }, select: { active: true } });
  if (!row) return { success: false, error: "Document type not found." };
  await prisma.hrRequiredDocType.update({ where: { id }, data: { active: !row.active } });
  revalidatePath("/people/settings/required-docs");
  return { success: true, data: { id, active: !row.active } };
}

export async function deleteRequiredDocType(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  try {
    await prisma.hrRequiredDocType.delete({ where: { id } });
    revalidatePath("/people/settings/required-docs");
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not delete the document type." };
  }
}

// ============================================================
// Per-employee checklist — required vs. what's on file
// ============================================================

// A required type is satisfied by any EMPLOYEE-scoped HrDocument whose title
// (or category name) reasonably matches the required name — case-insensitive,
// contains either way so "PAN Card" ↔ "PAN" both count.
function docMatchesRequirement(
  reqName: string,
  docs: { title: string; categoryName: string | null }[]
): boolean {
  const needle = reqName.trim().toLowerCase();
  if (!needle) return false;
  return docs.some((d) => {
    const title = d.title.toLowerCase();
    const cat = (d.categoryName ?? "").toLowerCase();
    return (
      title.includes(needle) ||
      needle.includes(title) ||
      (cat && (cat.includes(needle) || needle.includes(cat)))
    );
  });
}

export interface EmployeeChecklistItem {
  name: string;
  appliesTo: string;
  mandatory: boolean;
  present: boolean;
}
export interface EmployeeChecklist {
  items: EmployeeChecklistItem[];
  missingMandatory: number;
}

export async function getEmployeeDocChecklist(employeeId: string): Promise<EmployeeChecklist> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return { items: [], missingMandatory: 0 };

  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { employmentType: true },
  });
  if (!emp) return { items: [], missingMandatory: 0 };

  const empType = String(emp.employmentType);

  const [types, docs] = await Promise.all([
    prisma.hrRequiredDocType.findMany({
      where: { active: true, appliesTo: { in: ["ALL", empType] } },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { name: true, appliesTo: true, mandatory: true },
    }),
    prisma.hrDocument.findMany({
      where: { scope: "EMPLOYEE", employeeId, isActive: true },
      select: { title: true, category: { select: { name: true } } },
    }),
  ]);

  const docPairs = docs.map((d) => ({ title: d.title, categoryName: d.category?.name ?? null }));

  let missingMandatory = 0;
  const items: EmployeeChecklistItem[] = types.map((t) => {
    const present = docMatchesRequirement(t.name, docPairs);
    if (!present && t.mandatory) missingMandatory++;
    return { name: t.name, appliesTo: t.appliesTo, mandatory: t.mandatory, present };
  });

  return { items, missingMandatory };
}

// ============================================================
// Overview — how many active employees are missing a mandatory doc.
// Best-effort: capped scan so this stays cheap on large headcounts.
// ============================================================

const OVERVIEW_SCAN_CAP = 500;

export interface MissingMandatoryOverview {
  employeesWithMissing: number;
  scanned: number;
  capped: boolean;
  cap: number;
}

export async function getMissingMandatoryCounts(): Promise<MissingMandatoryOverview> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read"))
    return { employeesWithMissing: 0, scanned: 0, capped: false, cap: OVERVIEW_SCAN_CAP };

  const mandatoryTypes = await prisma.hrRequiredDocType.findMany({
    where: { active: true, mandatory: true },
    select: { name: true, appliesTo: true },
  });
  if (mandatoryTypes.length === 0)
    return { employeesWithMissing: 0, scanned: 0, capped: false, cap: OVERVIEW_SCAN_CAP };

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      employmentType: true,
      documents: {
        where: { scope: "EMPLOYEE", isActive: true },
        select: { title: true, category: { select: { name: true } } },
      },
    },
    take: OVERVIEW_SCAN_CAP + 1,
    orderBy: { createdAt: "asc" },
  });

  const capped = employees.length > OVERVIEW_SCAN_CAP;
  const scanList = capped ? employees.slice(0, OVERVIEW_SCAN_CAP) : employees;

  let employeesWithMissing = 0;
  for (const emp of scanList) {
    const empType = String(emp.employmentType);
    const applicable = mandatoryTypes.filter((t) => t.appliesTo === "ALL" || t.appliesTo === empType);
    if (applicable.length === 0) continue;
    const docPairs = emp.documents.map((d) => ({ title: d.title, categoryName: d.category?.name ?? null }));
    const hasMissing = applicable.some((t) => !docMatchesRequirement(t.name, docPairs));
    if (hasMissing) employeesWithMissing++;
  }

  return { employeesWithMissing, scanned: scanList.length, capped, cap: OVERVIEW_SCAN_CAP };
}
