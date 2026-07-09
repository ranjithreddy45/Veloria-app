"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { getESignProvider } from "@/lib/hr/esign";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}
async function myEmployeeId(userId: string) {
  const e = await prisma.employee.findFirst({ where: { userId, deletedAt: null }, select: { id: true } });
  return e?.id ?? null;
}

// ============================================================
// Categories
// ============================================================
export async function getDocumentCategories() {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  return prisma.hrDocumentCategory.findMany({ where: { isActive: true }, orderBy: [{ order: "asc" }, { name: "asc" }] });
}

export async function upsertDocumentCategory(input: { id?: string; name: string; scope: string }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  if (!input.name?.trim()) return { success: false, error: "Name is required." };
  const scope = input.scope === "EMPLOYEE" ? "EMPLOYEE" : "ORG";
  const rec = input.id
    ? await prisma.hrDocumentCategory.update({ where: { id: input.id }, data: { name: input.name.trim() } })
    : await prisma.hrDocumentCategory.create({ data: { name: input.name.trim(), scope } });
  revalidatePath("/people/documents");
  return { success: true, data: { id: rec.id } };
}

// ============================================================
// Org documents (+ my acknowledgement status)
// ============================================================
export async function getOrgDocuments() {
  const u = await requireUser();
  if (!u?.id || !can(u.role, "hr:read")) return { docs: [], myEmployeeId: null as string | null };
  const empId = await myEmployeeId(u.id);

  const docs = await prisma.hrDocument.findMany({
    where: { scope: "ORG", isActive: true },
    include: {
      category: { select: { name: true } },
      acknowledgements: empId ? { where: { employeeId: empId }, select: { acknowledgedAt: true } } : false,
      _count: { select: { acknowledgements: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return { docs, myEmployeeId: empId };
}

export async function getEmployeeDocuments(employeeId: string) {
  const u = await requireUser();
  if (!u?.id) return [];
  // HR can view anyone's; an employee can view their own.
  const isHr = can(u.role, "hr:read");
  const mine = await myEmployeeId(u.id);
  if (!isHr && mine !== employeeId) return [];

  return prisma.hrDocument.findMany({
    where: { scope: "EMPLOYEE", employeeId, isActive: true },
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export interface CreateDocInput {
  title: string; categoryId?: string; scope: string; fileUrl?: string;
  employeeId?: string; requiresAck?: boolean; expiryDate?: string;
}

export async function createDocument(input: CreateDocInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id || !can(u.role, "hr:write")) return { success: false, error: "Not authorized." };
  if (!input.title?.trim()) return { success: false, error: "Title is required." };
  const scope = input.scope === "EMPLOYEE" ? "EMPLOYEE" : "ORG";
  if (scope === "EMPLOYEE" && !input.employeeId) return { success: false, error: "Select an employee for an employee document." };

  const doc = await prisma.hrDocument.create({
    data: {
      title: input.title.trim(),
      categoryId: input.categoryId || null,
      scope,
      fileUrl: input.fileUrl?.trim() || null,
      employeeId: scope === "EMPLOYEE" ? input.employeeId : null,
      requiresAck: scope === "ORG" ? !!input.requiresAck : false,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      uploadedBy: u.id,
    },
  });
  await prisma.activityLog.create({
    data: { action: "DOCUMENT_ADDED", entityType: "HR_DOCUMENT", entityId: doc.id, userId: u.id, changes: { title: doc.title, scope } },
  });
  revalidatePath("/people/documents");
  if (scope === "EMPLOYEE" && input.employeeId) revalidatePath(`/people/${input.employeeId}`);
  return { success: true, data: { id: doc.id } };
}

export async function acknowledgeDocument(documentId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const empId = await myEmployeeId(u.id);
  if (!empId) return { success: false, error: "Your account isn't linked to an employee record." };

  // Only active, org-wide documents that actually require acknowledgement can be acked.
  const doc = await prisma.hrDocument.findUnique({
    where: { id: documentId },
    select: { scope: true, isActive: true, requiresAck: true },
  });
  if (!doc || !doc.isActive) return { success: false, error: "Document not found." };
  if (doc.scope !== "ORG" || !doc.requiresAck) return { success: false, error: "This document doesn't require acknowledgement." };

  await prisma.documentAcknowledgement.upsert({
    where: { documentId_employeeId: { documentId, employeeId: empId } },
    create: { documentId, employeeId: empId },
    update: {},
  });
  await prisma.activityLog.create({
    data: { action: "DOCUMENT_ACKNOWLEDGED", entityType: "HR_DOCUMENT", entityId: documentId, userId: u.id },
  });
  revalidatePath("/people/documents");
  return { success: true, data: { id: documentId } };
}

// Acknowledgement coverage for a document (HR view) — who has and hasn't acked.
export async function getAckCoverage(documentId: string) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;
  const [acks, activeEmployees] = await Promise.all([
    prisma.documentAcknowledgement.findMany({
      where: { documentId },
      include: { employee: { select: { id: true, firstName: true, lastName: true, empCode: true } } },
      orderBy: { acknowledgedAt: "desc" },
    }),
    prisma.employee.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } },
      select: { id: true, firstName: true, lastName: true, empCode: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);
  const ackedIds = new Set(acks.map((a) => a.employeeId));
  const acked = acks.map((a) => ({
    id: a.employee.id,
    firstName: a.employee.firstName,
    lastName: a.employee.lastName,
    empCode: a.employee.empCode,
    acknowledgedAt: a.acknowledgedAt,
  }));
  const pending = activeEmployees.filter((e) => !ackedIds.has(e.id));
  return { acked, pending, totalActive: activeEmployees.length };
}

export async function getExpiringDocuments(days = 30) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  const now = new Date();
  const until = new Date(now.getTime() + days * 86400000);
  return prisma.hrDocument.findMany({
    where: { isActive: true, expiryDate: { not: null, lte: until } },
    include: {
      category: { select: { name: true } },
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { expiryDate: "asc" },
  });
}

// ============================================================
// Templates (mail-merge)
// ============================================================
export async function getDocumentTemplates() {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  return prisma.hrDocumentTemplate.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function upsertDocumentTemplate(input: { id?: string; name: string; body: string }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  if (!input.name?.trim() || !input.body?.trim()) return { success: false, error: "Name and body are required." };
  const rec = input.id
    ? await prisma.hrDocumentTemplate.update({ where: { id: input.id }, data: { name: input.name.trim(), body: input.body } })
    : await prisma.hrDocumentTemplate.create({ data: { name: input.name.trim(), body: input.body } });
  revalidatePath("/people/documents");
  return { success: true, data: { id: rec.id } };
}

// Render a template against an employee's fields. Pure-ish (DB read only).
export async function renderTemplate(templateId: string, employeeId: string): Promise<Result<{ text: string }>> {
  const u = await requireUser();
  // Letter generation merges an individual's PII — restrict to HR who edit
  // records, not read-only roles like AUDITOR (which holds hr:read for compliance).
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  const [tpl, emp] = await Promise.all([
    prisma.hrDocumentTemplate.findUnique({ where: { id: templateId } }),
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: { legalEntity: true, department: true, designation: true, businessVertical: true },
    }),
  ]);
  if (!tpl) return { success: false, error: "Template not found." };
  if (!emp) return { success: false, error: "Employee not found." };

  const fmt = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d) : "");
  const map: Record<string, string> = {
    firstName: emp.firstName,
    lastName: emp.lastName,
    fullName: `${emp.firstName} ${emp.lastName}`,
    empCode: emp.empCode,
    designation: emp.designation?.name ?? "",
    department: emp.department?.name ?? "",
    legalEntity: emp.legalEntity?.name ?? "",
    businessVertical: emp.businessVertical?.name ?? "",
    workEmail: emp.workEmail ?? "",
    workLocation: emp.workLocation ?? "",
    dateOfJoining: fmt(emp.dateOfJoining),
  };
  const text = tpl.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => map[k] ?? `{{${k}}}`);
  return { success: true, data: { text } };
}

// ============================================================
// E-sign (adapter)
// ============================================================
export async function requestESign(documentId: string, signerName: string, signerEmail: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id || !can(u.role, "hr:write")) return { success: false, error: "Not authorized." };
  if (!signerName.trim() || !signerEmail.trim()) return { success: false, error: "Signer name and email are required." };

  const doc = await prisma.hrDocument.findUnique({ where: { id: documentId } });
  if (!doc) return { success: false, error: "Document not found." };

  const provider = getESignProvider();
  const sent = await provider.send({
    documentId, documentTitle: doc.title, fileUrl: doc.fileUrl,
    signerName: signerName.trim(), signerEmail: signerEmail.trim(),
  });

  const req = await prisma.eSignRequest.create({
    data: {
      documentId, signerName: signerName.trim(), signerEmail: signerEmail.trim(),
      provider: sent.provider, externalId: sent.externalId, requestedBy: u.id,
    },
  });
  await prisma.activityLog.create({
    data: { action: "ESIGN_REQUESTED", entityType: "HR_DOCUMENT", entityId: documentId, userId: u.id, changes: { signerEmail } },
  });
  revalidatePath("/people/documents");
  return { success: true, data: { id: req.id } };
}
