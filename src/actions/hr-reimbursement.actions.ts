"use server";

// ============================================================
// Employee expense reimbursements — IO layer.
// Lifecycle (mirrors HrArrear): employee SUBMITS (ESS) → HR APPROVES with a target
// pay run → the payroll run disburses it and stamps PAID. Non-taxable by default;
// HR flags taxable exceptions. Self-service reads/writes are strictly scoped to
// the signed-in user's own employee record; HR reads/decisions gate on hr:payroll.
// All Decimal money crosses the boundary via Number()-out / Prisma.Decimal-in.
// ============================================================

import { auth } from "@/../auth";
import { checkAttachments, type IncomingAttachment } from "@/lib/hr/claim-attachments";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { isSafeReceiptUrl } from "@/lib/sales/receipt";
import { REIMBURSEMENT_CATEGORIES, type ReimbursementCategory } from "@/lib/hr/reimbursement";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const ENTITY_ID = "BILLION";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}
/** Resolve the signed-in user's OWN employee record (self-service scoping). */
async function myEmployee(userId: string) {
  return prisma.employee.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, empCode: true },
  });
}

const serialize = (r: {
  id: string; employeeId: string; category: string; title: string; amount: Prisma.Decimal;
  taxable: boolean; claimDate: Date; billUrl: string | null; note: string | null; status: string;
  decisionNote: string | null; payFy: string | null; payMonth: number | null; runId: string | null;
  paidAt: Date | null; createdAt: Date;
}) => ({
  id: r.id, employeeId: r.employeeId, category: r.category, title: r.title, amount: Number(r.amount),
  taxable: r.taxable, claimDate: r.claimDate, hasBill: !!r.billUrl, note: r.note, status: r.status,
  decisionNote: r.decisionNote, payFy: r.payFy, payMonth: r.payMonth, runId: r.runId, paidAt: r.paidAt,
  createdAt: r.createdAt,
});

// ============================================================
// Employee self-service (ESS) — strictly own-record
// ============================================================
export interface SubmitReimbursementInput {
  category: string;
  title: string;
  amount: number;
  claimDate: string; // ISO date
  billUrl?: string; // base64 data-URL or safe URL
  note?: string;
}

export async function submitReimbursement(input: SubmitReimbursementInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const me = await myEmployee(u.id);
  if (!me) return { success: false, error: "Your account isn't linked to an employee record yet. Ask HR to connect your profile." };

  const category = String(input.category || "").toUpperCase();
  if (!REIMBURSEMENT_CATEGORIES.includes(category as ReimbursementCategory))
    return { success: false, error: "Pick a valid category." };
  const title = input.title?.trim();
  if (!title) return { success: false, error: "A short description is required." };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Claim amount must be greater than zero." };
  const claim = new Date(input.claimDate);
  if (Number.isNaN(claim.getTime())) return { success: false, error: "Pick a valid claim date." };
  if (input.billUrl && !isSafeReceiptUrl(input.billUrl)) return { success: false, error: "That receipt file isn't a supported image/PDF." };

  const created = await prisma.hrReimbursementClaim.create({
    data: {
      entityId: ENTITY_ID,
      employeeId: me.id,
      category,
      title,
      amount: new Prisma.Decimal(amount.toFixed(2)),
      claimDate: claim,
      billUrl: input.billUrl || null,
      note: input.note?.trim() || null,
      createdById: u.id,
    },
    select: { id: true },
  });

  revalidatePath("/me/reimbursements");
  revalidatePath("/people/payroll/reimbursements");
  return { success: true, data: { id: created.id } };
}

export async function listMyReimbursements() {
  const u = await requireUser();
  if (!u?.id) return [];
  const me = await myEmployee(u.id);
  if (!me) return [];
  const rows = await prisma.hrReimbursementClaim.findMany({
    where: { employeeId: me.id },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serialize);
}

/** Cancel own claim — only while still PENDING (HR hasn't acted). */
export async function cancelMyReimbursement(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const me = await myEmployee(u.id);
  if (!me) return { success: false, error: "No employee record." };

  const claimed = await prisma.hrReimbursementClaim.updateMany({
    where: { id, employeeId: me.id, status: "PENDING" },
    data: { status: "REJECTED", decisionNote: "Withdrawn by employee" },
  });
  if (claimed.count === 0) return { success: false, error: "Only a pending claim you own can be withdrawn." };
  revalidatePath("/me/reimbursements");
  revalidatePath("/people/payroll/reimbursements");
  return { success: true, data: { id } };
}

// ============================================================
// HR queue + decisions (hr:payroll)
// ============================================================
export async function listReimbursements(filter?: { status?: string }) {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return [];
  const where: Prisma.HrReimbursementClaimWhereInput = { entityId: ENTITY_ID };
  if (filter?.status && filter.status !== "ALL") where.status = filter.status;

  const rows = await prisma.hrReimbursementClaim.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  // Join employee names in memory (no Prisma relation on the model, by design).
  const emps = await prisma.employee.findMany({
    where: { id: { in: Array.from(new Set(rows.map((r) => r.employeeId))) } },
    select: { id: true, firstName: true, lastName: true, empCode: true },
  });
  const byId = new Map(emps.map((e) => [e.id, e]));
  return rows.map((r) => {
    const e = byId.get(r.employeeId);
    return { ...serialize(r), empCode: e?.empCode ?? "—", name: `${e?.firstName ?? ""} ${e?.lastName ?? ""}`.trim() || "Unknown" };
  });
}

export async function reimbursementStats() {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { pending: 0, approved: 0, paidThisRunable: 0, pendingAmount: 0 };
  const rows = await prisma.hrReimbursementClaim.findMany({
    where: { entityId: ENTITY_ID, status: { in: ["PENDING", "APPROVED"] } },
    select: { amount: true, status: true },
  });
  let pending = 0, approved = 0, pendingAmount = 0;
  for (const r of rows) {
    if (r.status === "PENDING") { pending++; pendingAmount += Number(r.amount); }
    else approved++;
  }
  return { pending, approved, paidThisRunable: approved, pendingAmount };
}

export interface DecideReimbursementInput {
  decision: "APPROVED" | "REJECTED";
  payFy?: string; // required to APPROVE — the run that will disburse it
  payMonth?: number;
  taxable?: boolean; // HR flags a taxable reimbursement on approval
  note?: string;
}

export async function decideReimbursement(id: string, input: DecideReimbursementInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!can(u.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const claim = await prisma.hrReimbursementClaim.findUnique({ where: { id }, select: { id: true, status: true, employeeId: true } });
  if (!claim) return { success: false, error: "Claim not found." };
  if (claim.status !== "PENDING") return { success: false, error: "Only a pending claim can be decided." };

  if (input.decision === "APPROVED") {
    const payFy = input.payFy?.trim();
    const payMonth = Number(input.payMonth);
    if (!payFy || !/^\d{4}-\d{2}$/.test(payFy)) return { success: false, error: "Pick the financial year of the pay run." };
    if (!Number.isInteger(payMonth) || payMonth < 1 || payMonth > 12) return { success: false, error: "Pick the month of the pay run." };

    try {
      await prisma.$transaction(async (tx) => {
        // Claim the PENDING→APPROVED transition atomically (no double-approve).
        const upd = await tx.hrReimbursementClaim.updateMany({
          where: { id, status: "PENDING" },
          data: {
            status: "APPROVED", payFy, payMonth, taxable: !!input.taxable,
            decidedById: u.id, decidedAt: new Date(), decisionNote: input.note?.trim() || null,
          },
        });
        if (upd.count === 0) throw new Error("ALREADY_DECIDED");
        await tx.activityLog.create({
          data: { action: "REIMBURSEMENT_APPROVED", entityType: "EMPLOYEE", entityId: claim.employeeId, userId: u.id, changes: { reimbursementId: id, payFy, payMonth, taxable: !!input.taxable } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Error && e.message === "ALREADY_DECIDED") return { success: false, error: "This claim was already decided." };
      return { success: false, error: "Could not approve the claim." };
    }
  } else {
    const upd = await prisma.hrReimbursementClaim.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED", decidedById: u.id, decidedAt: new Date(), decisionNote: input.note?.trim() || null },
    });
    if (upd.count === 0) return { success: false, error: "This claim was already decided." };
    await prisma.activityLog.create({
      data: { action: "REIMBURSEMENT_REJECTED", entityType: "EMPLOYEE", entityId: claim.employeeId, userId: u.id, changes: { reimbursementId: id } },
    });
  }

  revalidatePath("/people/payroll/reimbursements");
  revalidatePath("/me/reimbursements");
  return { success: true, data: { id } };
}

// ============================================================
// Attachments, the send-back loop, and the audit trail.
//
// Three gaps this closes:
//   • a claim could carry ONE bill, so a trip with a hotel, a cab and a meal
//     receipt arrived with two of them missing;
//   • HR could only approve or reject — there was no way to say "you forgot the
//     invoice", so incomplete claims were rejected outright and re-raised from
//     scratch, losing the original date and any discussion;
//   • only the CURRENT status was stored, so nobody could see that a claim had
//     been sent back once, or when the missing bill arrived.
// ============================================================

/** Statuses an employee may still edit. */
const EDITABLE_BY_EMPLOYEE = ["PENDING", "NEEDS_INFO"];

async function recordClaimEvent(
  claimId: string,
  action: string,
  opts: { from?: string | null; to?: string | null; note?: string | null; actorId?: string; actorName?: string | null }
) {
  // Best-effort: an audit row must never be the reason a money action fails.
  // A missing trail entry is recoverable; a blocked approval is not.
  try {
    await prisma.hrClaimEvent.create({
      data: {
        claimId,
        action,
        fromStatus: opts.from ?? null,
        toStatus: opts.to ?? null,
        note: opts.note ?? null,
        actorId: opts.actorId ?? null,
        actorName: opts.actorName ?? null,
      },
    });
  } catch (e) {
    console.error("[CLAIM_EVENT]", action, claimId, e);
  }
}

/** Attachments + full history for one claim. */
export async function getClaimDetail(claimId: string) {
  const u = await requireUser();
  if (!u?.id) return { success: false as const, error: "Not signed in." };

  const claim = await prisma.hrReimbursementClaim.findUnique({
    where: { id: claimId },
    select: {
      id: true, employeeId: true, status: true, title: true, amount: true,
      category: true, claimDate: true, note: true, decisionNote: true, billUrl: true,
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!claim) return { success: false as const, error: "Claim not found." };

  // An employee may see their OWN claim; HR may see any. Without this an
  // employee could read a colleague's claim, its amount and its receipts by id.
  const me = await myEmployee(u.id);
  const isOwner = me?.id === claim.employeeId;
  if (!isOwner && !can(u.role, "hr:payroll")) {
    return { success: false as const, error: "Insufficient permissions" };
  }

  return {
    success: true as const,
    data: {
      ...claim,
      amount: Number(claim.amount),
      hasLegacyBill: !!claim.billUrl,
      canEdit: isOwner && EDITABLE_BY_EMPLOYEE.includes(claim.status),
    },
  };
}

/** The bytes of one attachment, for viewing/downloading. */
export async function getClaimAttachment(attachmentId: string) {
  const u = await requireUser();
  if (!u?.id) return { success: false as const, error: "Not signed in." };

  const att = await prisma.hrClaimAttachment.findUnique({
    where: { id: attachmentId },
    select: { fileName: true, mimeType: true, data: true, claim: { select: { employeeId: true } } },
  });
  if (!att) return { success: false as const, error: "Attachment not found." };

  const me = await myEmployee(u.id);
  if (me?.id !== att.claim.employeeId && !can(u.role, "hr:payroll")) {
    return { success: false as const, error: "Insufficient permissions" };
  }
  return { success: true as const, data: { fileName: att.fileName, mimeType: att.mimeType, data: att.data } };
}

/** Attach one or more supporting documents to a claim. */
export async function addClaimAttachments(
  claimId: string,
  files: IncomingAttachment[]
): Promise<Result<{ added: number }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!files?.length) return { success: false, error: "Pick at least one file." };

  const claim = await prisma.hrReimbursementClaim.findUnique({
    where: { id: claimId },
    select: {
      employeeId: true, status: true,
      attachments: { select: { sizeBytes: true } },
    },
  });
  if (!claim) return { success: false, error: "Claim not found." };

  const me = await myEmployee(u.id);
  const isOwner = me?.id === claim.employeeId;
  const isHr = can(u.role, "hr:payroll");
  if (!isOwner && !isHr) return { success: false, error: "Insufficient permissions" };

  // A settled claim is evidence of a payment decision. Letting anyone bolt a
  // receipt onto an APPROVED or PAID claim would change what was approved after
  // the fact, with the approval still showing as given.
  if (!EDITABLE_BY_EMPLOYEE.includes(claim.status) && !isHr) {
    return { success: false, error: `A ${claim.status.toLowerCase()} claim can no longer be edited.` };
  }

  const existingBytes = claim.attachments.reduce((s, a) => s + (a.sizeBytes || 0), 0);
  const check = checkAttachments(files, claim.attachments.length, existingBytes);
  if (!check.ok) return { success: false, error: check.error ?? "Those attachments could not be accepted." };

  await prisma.hrClaimAttachment.createMany({
    data: files.map((f, i) => ({
      claimId,
      fileName: f.fileName.slice(0, 180),
      mimeType: f.mimeType,
      sizeBytes: check.sizes[i] ?? 0,
      data: f.data,
      uploadedById: u.id,
    })),
  });

  await recordClaimEvent(claimId, "EDITED", {
    from: claim.status, to: claim.status, actorId: u.id, actorName: u.name ?? null,
    note: `Added ${files.length} attachment${files.length === 1 ? "" : "s"}`,
  });

  revalidatePath("/me/reimbursements");
  revalidatePath("/people/payroll/reimbursements");
  return { success: true, data: { added: files.length } };
}

/** Remove one attachment before the claim is settled. */
export async function removeClaimAttachment(attachmentId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };

  const att = await prisma.hrClaimAttachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, fileName: true, claimId: true, claim: { select: { employeeId: true, status: true } } },
  });
  if (!att) return { success: false, error: "Attachment not found." };

  const me = await myEmployee(u.id);
  const isOwner = me?.id === att.claim.employeeId;
  const isHr = can(u.role, "hr:payroll");
  if (!isOwner && !isHr) return { success: false, error: "Insufficient permissions" };
  if (!EDITABLE_BY_EMPLOYEE.includes(att.claim.status) && !isHr) {
    return { success: false, error: `A ${att.claim.status.toLowerCase()} claim can no longer be edited.` };
  }

  await prisma.hrClaimAttachment.delete({ where: { id: attachmentId } });
  await recordClaimEvent(att.claimId, "EDITED", {
    from: att.claim.status, to: att.claim.status, actorId: u.id, actorName: u.name ?? null,
    note: `Removed attachment ${att.fileName}`,
  });

  revalidatePath("/me/reimbursements");
  revalidatePath("/people/payroll/reimbursements");
  return { success: true, data: { id: attachmentId } };
}

/**
 * HR sends a claim back for missing information instead of rejecting it.
 *
 * Rejection is final and loses the thread; most "bad" claims are simply
 * incomplete. This keeps the claim, its date and its history intact while
 * handing it back to the employee.
 */
export async function requestClaimInfo(claimId: string, note: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!can(u.role, "hr:payroll")) return { success: false, error: "Insufficient permissions" };

  const reason = (note ?? "").trim();
  if (!reason) return { success: false, error: "Say what is missing — the employee has to know what to add." };

  const claim = await prisma.hrReimbursementClaim.findUnique({ where: { id: claimId }, select: { status: true } });
  if (!claim) return { success: false, error: "Claim not found." };
  if (claim.status !== "PENDING") {
    return { success: false, error: `Only a pending claim can be sent back (this one is ${claim.status.toLowerCase()}).` };
  }

  await prisma.hrReimbursementClaim.updateMany({
    where: { id: claimId, status: "PENDING" },
    data: { status: "NEEDS_INFO", decisionNote: reason },
  });
  await recordClaimEvent(claimId, "INFO_REQUESTED", {
    from: "PENDING", to: "NEEDS_INFO", note: reason, actorId: u.id, actorName: u.name ?? null,
  });

  revalidatePath("/me/reimbursements");
  revalidatePath("/people/payroll/reimbursements");
  return { success: true, data: { id: claimId } };
}

/** The employee edits the details and sends it back to HR. */
export async function resubmitClaim(
  claimId: string,
  patch: { title?: string; amount?: number; note?: string }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const me = await myEmployee(u.id);
  if (!me) return { success: false, error: "Your account isn't linked to an employee record." };

  const claim = await prisma.hrReimbursementClaim.findUnique({
    where: { id: claimId },
    select: { employeeId: true, status: true },
  });
  if (!claim) return { success: false, error: "Claim not found." };
  if (claim.employeeId !== me.id) return { success: false, error: "That isn't your claim." };
  if (!EDITABLE_BY_EMPLOYEE.includes(claim.status)) {
    return { success: false, error: `A ${claim.status.toLowerCase()} claim can no longer be edited.` };
  }

  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { success: false, error: "A short description is required." };
    data.title = t;
  }
  if (patch.amount !== undefined) {
    const a = Number(patch.amount);
    if (!Number.isFinite(a) || a <= 0) return { success: false, error: "Claim amount must be greater than zero." };
    data.amount = new Prisma.Decimal(a.toFixed(2));
  }
  if (patch.note !== undefined) data.note = patch.note.trim() || null;

  // Back to PENDING so it re-enters HR's queue. Clearing decisionNote matters:
  // leaving "missing the hotel invoice" on a claim that now HAS it makes the
  // queue read as though the problem is outstanding.
  data.status = "PENDING";
  data.decisionNote = null;

  await prisma.hrReimbursementClaim.update({ where: { id: claimId }, data });
  await recordClaimEvent(claimId, "RESUBMITTED", {
    from: claim.status, to: "PENDING", actorId: u.id, actorName: u.name ?? null,
    note: "Employee updated the claim and sent it back for approval",
  });

  revalidatePath("/me/reimbursements");
  revalidatePath("/people/payroll/reimbursements");
  return { success: true, data: { id: claimId } };
}
