"use server";

// ============================================================
// CRM notes + call logs — editable, multiple per lead or enquiry.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) return null;
  return s.user as { id: string; name?: string | null; role?: string };
}

export interface CrmNoteDTO {
  id: string;
  kind: "NOTE" | "CALL";
  body: string;
  callOutcome: string | null;
  authorId: string;
  authorName: string | null;
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
}

function dto(n: { id: string; kind: string; body: string; callOutcome: string | null; authorId: string; createdAt: Date; editedAt: Date | null }, authorName: string | null, meId: string, isAdmin: boolean): CrmNoteDTO {
  return {
    id: n.id, kind: n.kind as "NOTE" | "CALL", body: n.body, callOutcome: n.callOutcome,
    authorId: n.authorId, authorName, createdAt: n.createdAt.toISOString(),
    editedAt: n.editedAt ? n.editedAt.toISOString() : null,
    canEdit: isAdmin || n.authorId === meId,
  };
}

/** All notes/calls for a lead or an enquiry, newest first. */
export async function listCrmNotes(params: { leadId?: string; inquiryId?: string }): Promise<Result<CrmNoteDTO[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!hasPermission(u.role ?? "", "leads:read")) return { success: false, error: "Insufficient permissions" };
  if (!params.leadId && !params.inquiryId) return { success: false, error: "A lead or enquiry is required." };

  const rows = await prisma.crmNote.findMany({
    where: { leadId: params.leadId ?? undefined, inquiryId: params.inquiryId ?? undefined },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const authors = await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } });
  const nameById = new Map(authors.map((a) => [a.id, a.name]));
  const isAdmin = u.role === "ADMIN" || u.role === "SUPER_ADMIN";
  return { success: true, data: rows.map((r) => dto(r, nameById.get(r.authorId) ?? null, u.id, isAdmin)) };
}

export async function addCrmNote(input: {
  leadId?: string; inquiryId?: string; kind?: "NOTE" | "CALL"; body: string; callOutcome?: string | null;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!hasPermission(u.role ?? "", "leads:update")) return { success: false, error: "You don't have permission to add notes." };
  const body = (input.body ?? "").trim();
  if (!body) return { success: false, error: "Note can't be empty." };
  if (!input.leadId && !input.inquiryId) return { success: false, error: "A lead or enquiry is required." };

  const n = await prisma.crmNote.create({
    data: {
      kind: input.kind ?? "NOTE", body: body.slice(0, 5000), callOutcome: input.callOutcome ?? null,
      leadId: input.leadId ?? null, inquiryId: input.inquiryId ?? null, authorId: u.id,
    },
    select: { id: true },
  });
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/inquiries");
  return { success: true, data: { id: n.id } };
}

export async function editCrmNote(id: string, input: { body: string; callOutcome?: string | null }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  const note = await prisma.crmNote.findUnique({ where: { id }, select: { authorId: true, leadId: true } });
  if (!note) return { success: false, error: "Note not found." };
  const isAdmin = u.role === "ADMIN" || u.role === "SUPER_ADMIN";
  if (note.authorId !== u.id && !isAdmin) return { success: false, error: "You can only edit your own notes." };
  const body = (input.body ?? "").trim();
  if (!body) return { success: false, error: "Note can't be empty." };
  await prisma.crmNote.update({ where: { id }, data: { body: body.slice(0, 5000), callOutcome: input.callOutcome ?? undefined, editedAt: new Date() } });
  if (note.leadId) revalidatePath(`/leads/${note.leadId}`);
  revalidatePath("/inquiries");
  return { success: true, data: { id } };
}

export async function deleteCrmNote(id: string): Promise<Result<{ deleted: true }>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  const note = await prisma.crmNote.findUnique({ where: { id }, select: { authorId: true, leadId: true } });
  if (!note) return { success: false, error: "Note not found." };
  const isAdmin = u.role === "ADMIN" || u.role === "SUPER_ADMIN";
  if (note.authorId !== u.id && !isAdmin) return { success: false, error: "You can only delete your own notes." };
  await prisma.crmNote.delete({ where: { id } });
  if (note.leadId) revalidatePath(`/leads/${note.leadId}`);
  revalidatePath("/inquiries");
  return { success: true, data: { deleted: true } };
}
