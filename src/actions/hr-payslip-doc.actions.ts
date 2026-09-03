"use server";

// ============================================================
// Uploaded payslip DOCUMENTS, month by month.
//
// Deliberately separate from HrPayslip, which payroll COMPUTES (earnings,
// deductions, PF/ESI/PT/TDS). These are files HR uploads, typically because
// payroll is run outside this system. Merging the two would give "the payslip"
// two meanings with no way to tell which is authoritative — and payslips are
// the document an employee takes to a bank or a landlord, so being wrong about
// which one is real is not a cosmetic problem.
//
// One document per employee per month, enforced by a unique constraint:
// re-uploading REPLACES. That is what "Edit/Replace" means, and it stops a
// month accumulating three near-identical PDFs nobody can choose between.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { dataUrlBytes } from "@/lib/hr/claim-attachments";

type Result<T> = { success: true; data: T } | { success: false; error: string };

/** A payslip is a PDF or a scan; nothing else makes sense here. */
const PAYSLIP_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
/** Same body-cap reasoning as claim attachments — one file, so a little more room. */
const PAYSLIP_MAX_BYTES = 3_000_000;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}

/** Employees may read their OWN payslips; HR may read and write any. */
async function scope(userId: string, role: string | undefined, employeeId: string) {
  const isHr = !!role && hasPermission(role, "hr:payroll");
  if (isHr) return { read: true, write: true };
  const me = await prisma.employee.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  return { read: me?.id === employeeId, write: false };
}

function validMonth(year: number, month: number): string | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return "Pick a valid year.";
  if (!Number.isInteger(month) || month < 1 || month > 12) return "Pick a valid month.";
  // A payslip for a month that has not happened yet is almost always a typo in
  // the month picker, and it would sort above every real payslip.
  const now = new Date();
  if (year > now.getUTCFullYear() || (year === now.getUTCFullYear() && month > now.getUTCMonth() + 1)) {
    return "That month is in the future.";
  }
  return null;
}

/** Month-wise list for one employee. Metadata only — never the file bytes. */
export async function listPayslipDocuments(employeeId: string) {
  const u = await requireUser();
  if (!u?.id) return { success: false as const, error: "Not signed in." };
  const s = await scope(u.id, u.role, employeeId);
  if (!s.read) return { success: false as const, error: "Insufficient permissions" };

  // Selecting `data` here would pull every payslip PDF into memory just to draw
  // a list of months.
  const rows = await prisma.hrPayslipDocument.findMany({
    where: { employeeId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: {
      id: true, year: true, month: true, fileName: true, mimeType: true,
      sizeBytes: true, note: true, uploadedByName: true, createdAt: true, updatedAt: true,
    },
  });
  return { success: true as const, data: rows, canManage: s.write };
}

/** The bytes, for viewing or downloading one payslip. */
export async function getPayslipDocument(id: string) {
  const u = await requireUser();
  if (!u?.id) return { success: false as const, error: "Not signed in." };

  const doc = await prisma.hrPayslipDocument.findUnique({
    where: { id },
    select: { employeeId: true, fileName: true, mimeType: true, data: true },
  });
  if (!doc) return { success: false as const, error: "Payslip not found." };

  const s = await scope(u.id, u.role, doc.employeeId);
  if (!s.read) return { success: false as const, error: "Insufficient permissions" };
  return { success: true as const, data: { fileName: doc.fileName, mimeType: doc.mimeType, data: doc.data } };
}

/**
 * Upload a payslip for a month — or replace the one already there.
 *
 * Upsert rather than create, so "Upload" and "Edit/Replace" are the same action
 * from the user's point of view. Two buttons that must not disagree about which
 * month they target is a bug waiting to happen.
 */
export async function upsertPayslipDocument(input: {
  employeeId: string;
  year: number;
  month: number;
  fileName: string;
  mimeType: string;
  data: string;
  note?: string;
}): Promise<Result<{ id: string; replaced: boolean }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!hasPermission(u.role ?? "", "hr:payroll")) {
    return { success: false, error: "Only HR can upload payslips." };
  }

  const monthError = validMonth(input.year, input.month);
  if (monthError) return { success: false, error: monthError };

  if (!PAYSLIP_MIME.includes(input.mimeType)) {
    return { success: false, error: "Upload a PDF, JPG, PNG or WEBP." };
  }
  const bytes = dataUrlBytes(input.data);
  if (bytes <= 0) return { success: false, error: "That file appears to be empty." };
  if (bytes > PAYSLIP_MAX_BYTES) {
    return {
      success: false,
      error: `That file is ${(bytes / 1_000_000).toFixed(1)}MB. Payslips must be under ${
        PAYSLIP_MAX_BYTES / 1_000_000
      }MB — export the PDF at a smaller size.`,
    };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) return { success: false, error: "Employee not found." };

  const existing = await prisma.hrPayslipDocument.findUnique({
    where: { employeeId_year_month: { employeeId: input.employeeId, year: input.year, month: input.month } },
    select: { id: true },
  });

  const row = await prisma.hrPayslipDocument.upsert({
    where: { employeeId_year_month: { employeeId: input.employeeId, year: input.year, month: input.month } },
    create: {
      employeeId: input.employeeId,
      year: input.year,
      month: input.month,
      fileName: input.fileName.slice(0, 180),
      mimeType: input.mimeType,
      sizeBytes: bytes,
      data: input.data,
      note: input.note?.trim() || null,
      uploadedById: u.id,
      uploadedByName: u.name ?? null,
    },
    update: {
      fileName: input.fileName.slice(0, 180),
      mimeType: input.mimeType,
      sizeBytes: bytes,
      data: input.data,
      note: input.note?.trim() || null,
      uploadedById: u.id,
      uploadedByName: u.name ?? null,
    },
    select: { id: true },
  });

  revalidatePath(`/people/${input.employeeId}`);
  revalidatePath("/people/my/payslips");
  return { success: true, data: { id: row.id, replaced: !!existing } };
}

/** Delete a payslip document. */
export async function removePayslipDocument(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!hasPermission(u.role ?? "", "hr:payroll")) {
    return { success: false, error: "Only HR can remove payslips." };
  }

  const doc = await prisma.hrPayslipDocument.findUnique({ where: { id }, select: { employeeId: true } });
  if (!doc) return { success: false, error: "Payslip not found." };

  await prisma.hrPayslipDocument.delete({ where: { id } });
  revalidatePath(`/people/${doc.employeeId}`);
  revalidatePath("/people/my/payslips");
  return { success: true, data: { id } };
}
