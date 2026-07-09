"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";

// --- auth / permission helpers (mirror hr-compensation.actions.ts) -----------
type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

function revalidateProfile(employeeId: string) {
  revalidatePath(`/people/${employeeId}`);
}

// Parse "yyyy-mm-dd" to a UTC date, or null for blank input.
function optDate(iso: string | undefined | null): Date | null {
  const s = (iso ?? "").trim();
  if (!s) return null;
  const d = new Date(s + "T00:00:00.000Z");
  return isNaN(d.getTime()) ? null : d;
}

// =====================================================================
// Serialisable client shapes (Dates -> ISO strings)
// =====================================================================
export interface EmergencyContactRow {
  id: string;
  name: string;
  relation: string | null;
  phone: string | null;
}
export interface EducationRow {
  id: string;
  institution: string;
  degree: string | null;
  year: number | null;
}
export interface WorkHistoryRow {
  id: string;
  company: string;
  title: string | null;
  fromDate: string | null; // ISO date
  toDate: string | null; // ISO date
}

// =====================================================================
// Reads (hr:read) — the profile page already fetches these via getEmployee,
// but expose them for completeness / client refresh.
// =====================================================================
export async function listEmergencyContacts(employeeId: string): Promise<EmergencyContactRow[]> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  const rows = await prisma.emergencyContact.findMany({
    where: { employeeId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, relation: r.relation, phone: r.phone }));
}

export async function listEducation(employeeId: string): Promise<EducationRow[]> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  const rows = await prisma.employeeEducation.findMany({
    where: { employeeId },
    orderBy: { year: "desc" },
  });
  return rows.map((r) => ({ id: r.id, institution: r.institution, degree: r.degree, year: r.year }));
}

export async function listWorkHistory(employeeId: string): Promise<WorkHistoryRow[]> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  const rows = await prisma.employeeWorkHistory.findMany({
    where: { employeeId },
    orderBy: { fromDate: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    company: r.company,
    title: r.title,
    fromDate: r.fromDate ? r.fromDate.toISOString() : null,
    toDate: r.toDate ? r.toDate.toISOString() : null,
  }));
}

// =====================================================================
// Emergency contacts (hr:write)
// =====================================================================
export interface EmergencyContactInput {
  employeeId: string;
  id?: string;
  name: string;
  relation?: string | null;
  phone?: string | null;
}

export async function upsertEmergencyContact(
  input: EmergencyContactInput,
): Promise<Result<EmergencyContactRow>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };

  const name = (input.name ?? "").trim();
  if (!name) return { success: false, error: "Name is required." };
  if (!input.employeeId) return { success: false, error: "Missing employee." };

  const data = {
    name,
    relation: (input.relation ?? "").trim() || null,
    phone: (input.phone ?? "").trim() || null,
  };

  const row = input.id
    ? await prisma.emergencyContact.update({
        where: { id: input.id },
        data,
      })
    : await prisma.emergencyContact.create({
        data: { employeeId: input.employeeId, ...data },
      });

  revalidateProfile(input.employeeId);
  return { success: true, data: { id: row.id, name: row.name, relation: row.relation, phone: row.phone } };
}

export async function deleteEmergencyContact(input: {
  employeeId: string;
  id: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  if (!input.id) return { success: false, error: "Missing record." };

  await prisma.emergencyContact.delete({ where: { id: input.id } });
  revalidateProfile(input.employeeId);
  return { success: true, data: { id: input.id } };
}

// =====================================================================
// Education (hr:write)
// =====================================================================
export interface EducationInput {
  employeeId: string;
  id?: string;
  institution: string;
  degree?: string | null;
  year?: number | string | null;
}

export async function upsertEducation(input: EducationInput): Promise<Result<EducationRow>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };

  const institution = (input.institution ?? "").trim();
  if (!institution) return { success: false, error: "Institution is required." };
  if (!input.employeeId) return { success: false, error: "Missing employee." };

  let year: number | null = null;
  const rawYear = typeof input.year === "string" ? input.year.trim() : input.year;
  if (rawYear !== null && rawYear !== undefined && rawYear !== "") {
    const n = Number(rawYear);
    if (!Number.isInteger(n) || n < 1900 || n > 2100) {
      return { success: false, error: "Enter a valid year (1900–2100)." };
    }
    year = n;
  }

  const data = {
    institution,
    degree: (input.degree ?? "").trim() || null,
    year,
  };

  const row = input.id
    ? await prisma.employeeEducation.update({ where: { id: input.id }, data })
    : await prisma.employeeEducation.create({ data: { employeeId: input.employeeId, ...data } });

  revalidateProfile(input.employeeId);
  return { success: true, data: { id: row.id, institution: row.institution, degree: row.degree, year: row.year } };
}

export async function deleteEducation(input: {
  employeeId: string;
  id: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  if (!input.id) return { success: false, error: "Missing record." };

  await prisma.employeeEducation.delete({ where: { id: input.id } });
  revalidateProfile(input.employeeId);
  return { success: true, data: { id: input.id } };
}

// =====================================================================
// Work history (hr:write)
// =====================================================================
export interface WorkHistoryInput {
  employeeId: string;
  id?: string;
  company: string;
  title?: string | null;
  fromDate?: string | null; // yyyy-mm-dd
  toDate?: string | null; // yyyy-mm-dd
}

export async function upsertWorkHistory(input: WorkHistoryInput): Promise<Result<WorkHistoryRow>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };

  const company = (input.company ?? "").trim();
  if (!company) return { success: false, error: "Company is required." };
  if (!input.employeeId) return { success: false, error: "Missing employee." };

  const fromDate = optDate(input.fromDate);
  const toDate = optDate(input.toDate);
  if (fromDate && toDate && toDate < fromDate) {
    return { success: false, error: "To date cannot be before from date." };
  }

  const data = {
    company,
    title: (input.title ?? "").trim() || null,
    fromDate,
    toDate,
  };

  const row = input.id
    ? await prisma.employeeWorkHistory.update({ where: { id: input.id }, data })
    : await prisma.employeeWorkHistory.create({ data: { employeeId: input.employeeId, ...data } });

  revalidateProfile(input.employeeId);
  return {
    success: true,
    data: {
      id: row.id,
      company: row.company,
      title: row.title,
      fromDate: row.fromDate ? row.fromDate.toISOString() : null,
      toDate: row.toDate ? row.toDate.toISOString() : null,
    },
  };
}

export async function deleteWorkHistory(input: {
  employeeId: string;
  id: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  if (!input.id) return { success: false, error: "Missing record." };

  await prisma.employeeWorkHistory.delete({ where: { id: input.id } });
  revalidateProfile(input.employeeId);
  return { success: true, data: { id: input.id } };
}
