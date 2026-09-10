"use server";

// ============================================================
// Employee expense reimbursements — IO layer.
// Lifecycle: employee SUBMITS (ESS) → LEVEL 1 approval (first-level
// validation) → LEVEL 2 approval (resolved from the employee's department)
// → APPROVED, now visible to Finance → Finance schedules it on a pay run
// (payroll disburses and stamps PAID) or records a direct payment → PAID.
// Every step writes an HrClaimEvent with actor + timestamp and notifies the
// next person in the chain (in-app + email). Finance cannot see a claim
// before both approvals are complete. Rules live in lib/hr/claim-workflow.ts.
// Self-service reads/writes are strictly scoped to the signed-in user's own
// employee record. All Decimal money crosses the boundary via Number()-out /
// Prisma.Decimal-in.
// ============================================================

import { auth } from "@/../auth";
import { checkAttachments, type IncomingAttachment } from "@/lib/hr/claim-attachments";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { isSafeReceiptUrl } from "@/lib/sales/receipt";
import { REIMBURSEMENT_CATEGORIES, type ReimbursementCategory } from "@/lib/hr/reimbursement";
import {
  awaitingLevel,
  describeClaim,
  financeRecipients,
  notifyClaimStep,
  resolveClaimApprovers,
  type ApproverUser,
} from "@/lib/hr/claim-workflow";

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
const isSuperAdmin = (role?: string) => role === "SUPER_ADMIN";
/** Resolve the signed-in user's OWN employee record (self-service scoping). */
async function myEmployee(userId: string) {
  return prisma.employee.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, empCode: true, departmentId: true },
  });
}

const PATHS = ["/me/reimbursements", "/me/approvals", "/people/payroll/reimbursements", "/finance/reimbursements"];
function revalidateAll() {
  for (const p of PATHS) revalidatePath(p);
}

type ClaimRow = {
  id: string; employeeId: string; category: string; title: string; amount: Prisma.Decimal;
  taxable: boolean; claimDate: Date; billUrl: string | null; note: string | null; status: string;
  decisionNote: string | null; payFy: string | null; payMonth: number | null; runId: string | null;
  paidAt: Date | null; createdAt: Date;
  level1ById: string | null; level1At: Date | null; level1Note: string | null;
  level2ById: string | null; level2At: Date | null; level2Note: string | null;
  paymentRef: string | null;
};
const serialize = (r: ClaimRow) => ({
  id: r.id, employeeId: r.employeeId, category: r.category, title: r.title, amount: Number(r.amount),
  taxable: r.taxable, claimDate: r.claimDate, hasBill: !!r.billUrl, note: r.note, status: r.status,
  decisionNote: r.decisionNote, payFy: r.payFy, payMonth: r.payMonth, runId: r.runId, paidAt: r.paidAt,
  createdAt: r.createdAt,
  level1At: r.level1At, level1Note: r.level1Note, level2At: r.level2At, level2Note: r.level2Note,
  paymentRef: r.paymentRef,
});

async function recordClaimEvent(
  claimId: string,
  action: string,
  opts: { from?: string | null; to?: string | null; note?: string | null; actorId?: string; actorName?: string | null }
) {
  // Best-effort: an audit row must never be the reason a money action fails.
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

/** The employee's login (for decision notifications), if linked. */
async function employeeUser(employeeId: string): Promise<ApproverUser | null> {
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { userId: true, firstName: true, lastName: true, departmentId: true },
  });
  if (!emp?.userId) return null;
  const u = await prisma.user.findUnique({ where: { id: emp.userId }, select: { id: true, name: true, email: true } });
  return u;
}

async function employeeBrief(employeeId: string) {
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, firstName: true, lastName: true, empCode: true, departmentId: true, userId: true },
  });
  return e
    ? { ...e, name: `${e.firstName} ${e.lastName}`.trim() || "Unknown" }
    : { id: employeeId, firstName: "", lastName: "", empCode: "—", departmentId: null, userId: null, name: "Unknown" };
}

/** Names of the configured approvers, resolved once for a whole list. */
async function approverNameResolver() {
  const rules = await prisma.hrReimbursementApprover.findMany();
  const users = rules.length
    ? await prisma.user.findMany({ where: { id: { in: rules.map((r) => r.userId) } }, select: { id: true, name: true } })
    : [];
  const name = (id?: string | null) => (id ? users.find((u) => u.id === id)?.name ?? null : null);
  const l1 = rules.find((r) => r.level === 1 && r.scope === "ALL");
  return (departmentId: string | null) => {
    const l2 =
      (departmentId && rules.find((r) => r.level === 2 && r.scope === departmentId)) ||
      rules.find((r) => r.level === 2 && r.scope === "ALL") ||
      null;
    return { level1Name: name(l1?.userId) ?? "Administrator", level2Name: name(l2?.userId) };
  };
}

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
  await recordClaimEvent(created.id, "SUBMITTED", {
    from: null, to: "PENDING", actorId: u.id, actorName: u.name ?? null,
  });

  // Step 2 begins: the first-level approver is told immediately.
  const approvers = await resolveClaimApprovers({ departmentId: me.departmentId });
  await notifyClaimStep(approvers.level1, {
    title: "Reimbursement claim awaiting your approval",
    body: `${describeClaim({ title, amount, employeeName: `${me.firstName} ${me.lastName}`.trim() })} needs first-level approval.`,
    actionUrl: "/me/approvals",
    claimId: created.id,
  });

  revalidateAll();
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

/** Withdraw own claim — while it is still awaiting an approval. */
export async function cancelMyReimbursement(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const me = await myEmployee(u.id);
  if (!me) return { success: false, error: "No employee record." };

  const before = await prisma.hrReimbursementClaim.findFirst({ where: { id, employeeId: me.id }, select: { status: true } });
  const claimed = await prisma.hrReimbursementClaim.updateMany({
    where: { id, employeeId: me.id, status: { in: ["PENDING", "PENDING_L2"] } },
    data: { status: "REJECTED", decisionNote: "Withdrawn by employee" },
  });
  if (claimed.count === 0) return { success: false, error: "Only a claim still awaiting approval can be withdrawn." };
  await recordClaimEvent(id, "WITHDRAWN", { from: before?.status, to: "REJECTED", actorId: u.id, actorName: u.name ?? null });
  revalidateAll();
  return { success: true, data: { id } };
}

// ============================================================
// HR overview (hr:payroll) — every claim, read-only except send-back
// ============================================================
export async function listReimbursements(filter?: { status?: string }) {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return [];
  const where: Prisma.HrReimbursementClaimWhereInput = { entityId: ENTITY_ID };
  if (filter?.status && filter.status !== "ALL") where.status = filter.status;

  const rows = await prisma.hrReimbursementClaim.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  const emps = await prisma.employee.findMany({
    where: { id: { in: Array.from(new Set(rows.map((r) => r.employeeId))) } },
    select: { id: true, firstName: true, lastName: true, empCode: true, departmentId: true },
  });
  const byId = new Map(emps.map((e) => [e.id, e]));
  const approverNames = await approverNameResolver();
  return rows.map((r) => {
    const e = byId.get(r.employeeId);
    const names = approverNames(e?.departmentId ?? null);
    const level = awaitingLevel(r.status);
    return {
      ...serialize(r),
      empCode: e?.empCode ?? "—",
      name: `${e?.firstName ?? ""} ${e?.lastName ?? ""}`.trim() || "Unknown",
      awaitingName: level === 1 ? names.level1Name : level === 2 ? names.level2Name : null,
    };
  });
}

export async function reimbursementStats() {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { pending: 0, approved: 0, paidThisRunable: 0, pendingAmount: 0 };
  const rows = await prisma.hrReimbursementClaim.findMany({
    where: { entityId: ENTITY_ID, status: { in: ["PENDING", "PENDING_L2", "APPROVED"] } },
    select: { amount: true, status: true },
  });
  let pending = 0, approved = 0, pendingAmount = 0;
  for (const r of rows) {
    if (r.status === "APPROVED") approved++;
    else { pending++; pendingAmount += Number(r.amount); }
  }
  return { pending, approved, paidThisRunable: approved, pendingAmount };
}

// ============================================================
// Approvals — level 1 and level 2
// ============================================================
export interface DecideReimbursementInput {
  decision: "APPROVED" | "REJECTED";
  note?: string;
}

/**
 * The one decision path for both levels. The level is read from the claim's
 * status; the caller must be that level's resolved approver (or SUPER_ADMIN).
 * Approving at level 1 hands the claim to level 2; the final approval sends it
 * to Finance. Rejection at either level closes the claim.
 */
export async function decideReimbursement(id: string, input: DecideReimbursementInput): Promise<Result<{ id: string; status: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };

  const claim = await prisma.hrReimbursementClaim.findUnique({
    where: { id },
    select: { id: true, status: true, employeeId: true, title: true, amount: true },
  });
  if (!claim) return { success: false, error: "Claim not found." };
  const level = awaitingLevel(claim.status);
  if (!level) return { success: false, error: "This claim is not awaiting approval." };

  const emp = await employeeBrief(claim.employeeId);
  const approvers = await resolveClaimApprovers({ departmentId: emp.departmentId });
  const mine = (level === 1 ? approvers.level1 : approvers.level2).some((a) => a.id === u.id);
  if (!mine && !isSuperAdmin(u.role)) {
    const who = level === 1 ? approvers.level1 : approvers.level2;
    return {
      success: false,
      error: `This claim is waiting for ${who.map((w) => w.name ?? w.email).join(" / ") || "its approver"} (level ${level}).`,
    };
  }

  const note = input.note?.trim() || null;
  const now = new Date();
  const summary = describeClaim({ title: claim.title, amount: Number(claim.amount), employeeName: emp.name });

  if (input.decision === "REJECTED") {
    const upd = await prisma.hrReimbursementClaim.updateMany({
      where: { id, status: claim.status },
      data: {
        status: "REJECTED", decidedById: u.id, decidedAt: now, decisionNote: note,
        ...(level === 1 ? { level1ById: u.id, level1At: now, level1Note: note } : { level2ById: u.id, level2At: now, level2Note: note }),
      },
    });
    if (upd.count === 0) return { success: false, error: "This claim was already decided." };
    await recordClaimEvent(id, "REJECTED", { from: claim.status, to: "REJECTED", note, actorId: u.id, actorName: u.name ?? null });
    await prisma.activityLog.create({
      data: { action: "REIMBURSEMENT_REJECTED", entityType: "EMPLOYEE", entityId: claim.employeeId, userId: u.id, changes: { reimbursementId: id, level } },
    });
    const owner = await employeeUser(claim.employeeId);
    if (owner) {
      await notifyClaimStep([owner], {
        title: "Reimbursement claim rejected",
        body: `Your claim "${claim.title}" was rejected at level ${level}${note ? `: ${note}` : "."}`,
        actionUrl: "/me/reimbursements",
        claimId: id,
      });
    }
    revalidateAll();
    return { success: true, data: { id, status: "REJECTED" } };
  }

  // APPROVE at this level.
  const goesToLevel2 = level === 1 && approvers.level2.length > 0;
  const nextStatus = goesToLevel2 ? "PENDING_L2" : "APPROVED";
  const upd = await prisma.hrReimbursementClaim.updateMany({
    where: { id, status: claim.status },
    data: {
      status: nextStatus,
      ...(level === 1 ? { level1ById: u.id, level1At: now, level1Note: note } : { level2ById: u.id, level2At: now, level2Note: note }),
      ...(nextStatus === "APPROVED" ? { decidedById: u.id, decidedAt: now, decisionNote: note } : {}),
    },
  });
  if (upd.count === 0) return { success: false, error: "This claim was already decided." };

  await recordClaimEvent(id, level === 1 ? "LEVEL1_APPROVED" : "LEVEL2_APPROVED", {
    from: claim.status, to: nextStatus, note, actorId: u.id, actorName: u.name ?? null,
  });

  if (goesToLevel2) {
    await notifyClaimStep(approvers.level2, {
      title: "Reimbursement claim awaiting your approval",
      body: `${summary} has first-level approval from ${u.name ?? "the first approver"} and now needs your second-level approval.`,
      actionUrl: "/me/approvals",
      claimId: id,
    });
  } else {
    if (level === 1) {
      await recordClaimEvent(id, "LEVEL2_SKIPPED", {
        from: "PENDING", to: "APPROVED", actorId: u.id, actorName: u.name ?? null,
        note: "No second-level approver is configured for this employee's department.",
      });
    }
    await recordClaimEvent(id, "APPROVED", { from: claim.status, to: "APPROVED", actorId: u.id, actorName: u.name ?? null });
    await prisma.activityLog.create({
      data: { action: "REIMBURSEMENT_APPROVED", entityType: "EMPLOYEE", entityId: claim.employeeId, userId: u.id, changes: { reimbursementId: id, level } },
    });
    await notifyClaimStep(await financeRecipients(), {
      title: "Reimbursement approved — ready for payment",
      body: `${summary} has completed all approvals and is ready for Finance to process.`,
      actionUrl: "/finance/reimbursements",
      claimId: id,
    });
    const owner = await employeeUser(claim.employeeId);
    if (owner) {
      await notifyClaimStep([owner], {
        title: "Reimbursement claim approved",
        body: `Your claim "${claim.title}" is fully approved and with Finance for payment.`,
        actionUrl: "/me/reimbursements",
        claimId: id,
      });
    }
  }

  revalidateAll();
  return { success: true, data: { id, status: nextStatus } };
}

/** Claims waiting on the signed-in user's decision (SUPER_ADMIN sees every awaiting claim). */
export async function listMyApprovals() {
  const u = await requireUser();
  if (!u?.id) return [];
  const rows = await prisma.hrReimbursementClaim.findMany({
    where: { entityId: ENTITY_ID, status: { in: ["PENDING", "PENDING_L2"] } },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { attachments: true } } },
  });
  if (rows.length === 0) return [];
  const emps = await prisma.employee.findMany({
    where: { id: { in: Array.from(new Set(rows.map((r) => r.employeeId))) } },
    select: { id: true, firstName: true, lastName: true, empCode: true, departmentId: true, department: { select: { name: true } } },
  });
  const byId = new Map(emps.map((e) => [e.id, e]));
  const rules = await prisma.hrReimbursementApprover.findMany();
  const l1 = rules.find((r) => r.level === 1 && r.scope === "ALL");
  const superAdmin = isSuperAdmin(u.role);
  const mineAtL1 = superAdmin || (l1 ? l1.userId === u.id : u.role === "SUPER_ADMIN");
  const out = [];
  for (const r of rows) {
    const e = byId.get(r.employeeId);
    const level = awaitingLevel(r.status)!;
    let mine = false;
    if (level === 1) mine = mineAtL1;
    else {
      const l2 =
        (e?.departmentId && rules.find((x) => x.level === 2 && x.scope === e.departmentId)) ||
        rules.find((x) => x.level === 2 && x.scope === "ALL");
      mine = superAdmin || l2?.userId === u.id;
    }
    if (!mine) continue;
    out.push({
      ...serialize(r),
      level,
      attachmentCount: r._count.attachments + (r.billUrl ? 1 : 0),
      empCode: e?.empCode ?? "—",
      name: `${e?.firstName ?? ""} ${e?.lastName ?? ""}`.trim() || "Unknown",
      department: e?.department?.name ?? null,
    });
  }
  return out;
}

/** Send a claim back to the employee for missing information. */
export async function requestClaimInfo(claimId: string, note: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };

  const reason = (note ?? "").trim();
  if (!reason) return { success: false, error: "Say what is missing — the employee has to know what to add." };

  const claim = await prisma.hrReimbursementClaim.findUnique({ where: { id: claimId }, select: { status: true, employeeId: true, title: true } });
  if (!claim) return { success: false, error: "Claim not found." };
  const level = awaitingLevel(claim.status);
  if (!level) return { success: false, error: `Only a claim awaiting approval can be sent back (this one is ${claim.status.toLowerCase()}).` };

  // HR, the current approver, or an admin may send it back.
  if (!can(u.role, "hr:payroll") && !isSuperAdmin(u.role)) {
    const emp = await employeeBrief(claim.employeeId);
    const approvers = await resolveClaimApprovers({ departmentId: emp.departmentId });
    const mine = (level === 1 ? approvers.level1 : approvers.level2).some((a) => a.id === u.id);
    if (!mine) return { success: false, error: "Insufficient permissions" };
  }

  await prisma.hrReimbursementClaim.updateMany({
    where: { id: claimId, status: claim.status },
    data: { status: "NEEDS_INFO", decisionNote: reason },
  });
  await recordClaimEvent(claimId, "INFO_REQUESTED", {
    from: claim.status, to: "NEEDS_INFO", note: reason, actorId: u.id, actorName: u.name ?? null,
  });
  const owner = await employeeUser(claim.employeeId);
  if (owner) {
    await notifyClaimStep([owner], {
      title: "Your reimbursement claim needs more information",
      body: `"${claim.title}": ${reason}`,
      actionUrl: "/me/reimbursements",
      claimId,
    });
  }

  revalidateAll();
  return { success: true, data: { id: claimId } };
}

// ============================================================
// Finance — only fully approved claims are visible here
// ============================================================
function canFinance(role?: string) {
  return can(role, "finance:read") || can(role, "hr:payroll");
}

export async function listFinanceReimbursements() {
  const u = await requireUser();
  if (!canFinance(u?.role)) return [];
  const rows = await prisma.hrReimbursementClaim.findMany({
    where: { entityId: ENTITY_ID, status: { in: ["APPROVED", "PAID"] } },
    orderBy: [{ status: "asc" }, { decidedAt: "desc" }],
  });
  const emps = await prisma.employee.findMany({
    where: { id: { in: Array.from(new Set(rows.map((r) => r.employeeId))) } },
    select: { id: true, firstName: true, lastName: true, empCode: true, department: { select: { name: true } } },
  });
  const byId = new Map(emps.map((e) => [e.id, e]));
  const approverIds = Array.from(new Set(rows.flatMap((r) => [r.level1ById, r.level2ById]).filter(Boolean) as string[]));
  const approvers = approverIds.length
    ? await prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = (id: string | null) => (id ? approvers.find((a) => a.id === id)?.name ?? "—" : null);
  return rows.map((r) => {
    const e = byId.get(r.employeeId);
    return {
      ...serialize(r),
      empCode: e?.empCode ?? "—",
      name: `${e?.firstName ?? ""} ${e?.lastName ?? ""}`.trim() || "Unknown",
      department: e?.department?.name ?? null,
      level1By: nameOf(r.level1ById),
      level2By: nameOf(r.level2ById),
    };
  });
}

/** Finance assigns the approved claim to the payroll run that will disburse it. */
export async function scheduleReimbursementPayment(
  id: string,
  input: { payFy: string; payMonth: number; taxable?: boolean }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!canFinance(u.role)) return { success: false, error: "Not authorized." };
  const payFy = input.payFy?.trim();
  const payMonth = Number(input.payMonth);
  if (!payFy || !/^\d{4}-\d{2}$/.test(payFy)) return { success: false, error: "Pick the financial year of the pay run." };
  if (!Number.isInteger(payMonth) || payMonth < 1 || payMonth > 12) return { success: false, error: "Pick the month of the pay run." };

  const upd = await prisma.hrReimbursementClaim.updateMany({
    where: { id, status: "APPROVED" },
    data: { payFy, payMonth, taxable: !!input.taxable },
  });
  if (upd.count === 0) return { success: false, error: "Only a fully approved, unpaid claim can be scheduled." };
  await recordClaimEvent(id, "PAY_RUN_SCHEDULED", {
    from: "APPROVED", to: "APPROVED", actorId: u.id, actorName: u.name ?? null,
    note: `Scheduled on the ${payMonth}/${payFy} pay run${input.taxable ? " (taxable)" : ""}`,
  });
  revalidateAll();
  return { success: true, data: { id } };
}

/** Finance records a payment made outside payroll (bank transfer / cash). */
export async function markReimbursementPaid(
  id: string,
  input: { paidOn?: string; reference?: string; note?: string }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!canFinance(u.role)) return { success: false, error: "Not authorized." };

  const claim = await prisma.hrReimbursementClaim.findUnique({ where: { id }, select: { status: true, employeeId: true, title: true } });
  if (!claim) return { success: false, error: "Claim not found." };
  if (claim.status !== "APPROVED") return { success: false, error: "Only a fully approved, unpaid claim can be marked paid." };

  const paidAt = input.paidOn ? new Date(input.paidOn) : new Date();
  if (Number.isNaN(paidAt.getTime())) return { success: false, error: "Pick a valid payment date." };
  const reference = input.reference?.trim() || null;

  const upd = await prisma.hrReimbursementClaim.updateMany({
    where: { id, status: "APPROVED" },
    data: { status: "PAID", paidAt, paymentRef: reference },
  });
  if (upd.count === 0) return { success: false, error: "This claim was already paid." };
  await recordClaimEvent(id, "PAID", {
    from: "APPROVED", to: "PAID", actorId: u.id, actorName: u.name ?? null,
    note: [reference ? `Ref ${reference}` : null, input.note?.trim() || null].filter(Boolean).join(" · ") || null,
  });
  const owner = await employeeUser(claim.employeeId);
  if (owner) {
    await notifyClaimStep([owner], {
      title: "Reimbursement paid",
      body: `Your claim "${claim.title}" has been paid${reference ? ` (ref ${reference})` : ""}.`,
      actionUrl: "/me/reimbursements",
      claimId: id,
    });
  }
  revalidateAll();
  return { success: true, data: { id } };
}

// ============================================================
// Approver configuration (hr:admin)
// ============================================================
export async function getReimbursementApproverConfig() {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false as const, error: "Not authorized." };
  const [rules, departments, candidates] = await Promise.all([
    prisma.hrReimbursementApprover.findMany(),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { isActive: true, role: { notIn: ["CLIENT", "VENDOR"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);
  return {
    success: true as const,
    data: {
      level1UserId: rules.find((r) => r.level === 1 && r.scope === "ALL")?.userId ?? null,
      level2Default: rules.find((r) => r.level === 2 && r.scope === "ALL")?.userId ?? null,
      level2ByDepartment: Object.fromEntries(
        rules.filter((r) => r.level === 2 && r.scope !== "ALL").map((r) => [r.scope, r.userId])
      ) as Record<string, string>,
      departments,
      candidates,
    },
  };
}

export async function setReimbursementApprover(input: {
  level: 1 | 2;
  scope: string; // "ALL" or a departmentId
  userId: string | null; // null clears the rule
}): Promise<Result<{ ok: true }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const level = input.level === 2 ? 2 : 1;
  const scope = level === 1 ? "ALL" : (input.scope || "ALL");
  if (!input.userId) {
    await prisma.hrReimbursementApprover.deleteMany({ where: { level, scope } });
  } else {
    const user = await prisma.user.findFirst({ where: { id: input.userId, isActive: true }, select: { id: true } });
    if (!user) return { success: false, error: "Pick an active login." };
    await prisma.hrReimbursementApprover.upsert({
      where: { level_scope: { level, scope } },
      update: { userId: user.id },
      create: { level, scope, userId: user.id },
    });
  }
  await prisma.activityLog.create({
    data: { action: "REIMBURSEMENT_APPROVER_SET", entityType: "HR_CONFIG", entityId: `${level}:${scope}`, userId: u!.id, changes: { userId: input.userId } },
  });
  revalidatePath("/people/payroll/reimbursements/approvers");
  return { success: true, data: { ok: true } };
}

// ============================================================
// Attachments, the send-back loop, and the audit trail.
// ============================================================

/** Statuses an employee may still edit (attachments/details). */
const EDITABLE_BY_EMPLOYEE = ["PENDING", "NEEDS_INFO"];

/** May this user read this claim (its amount, receipts and history)? */
async function canReadClaim(u: { id: string; role?: string }, claim: { employeeId: string; status: string }) {
  const me = await myEmployee(u.id);
  if (me?.id === claim.employeeId) return { ok: true, isOwner: true, isHr: can(u.role, "hr:payroll") };
  const isHr = can(u.role, "hr:payroll");
  if (isHr || isSuperAdmin(u.role) || can(u.role, "finance:read")) return { ok: true, isOwner: false, isHr };
  // An approver in this claim's chain.
  const emp = await employeeBrief(claim.employeeId);
  const approvers = await resolveClaimApprovers({ departmentId: emp.departmentId });
  const inChain = [...approvers.level1, ...approvers.level2].some((a) => a.id === u.id);
  return { ok: inChain, isOwner: false, isHr };
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
      level1ById: true, level1At: true, level1Note: true, level2ById: true, level2At: true, level2Note: true,
      payFy: true, payMonth: true, paidAt: true, paymentRef: true,
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!claim) return { success: false as const, error: "Claim not found." };

  const access = await canReadClaim(u, claim);
  if (!access.ok) return { success: false as const, error: "Insufficient permissions" };

  const emp = await employeeBrief(claim.employeeId);
  const names = await approverNameResolver();
  const chain = names(emp.departmentId);

  return {
    success: true as const,
    data: {
      ...claim,
      amount: Number(claim.amount),
      hasLegacyBill: !!claim.billUrl,
      canEdit: access.isOwner && EDITABLE_BY_EMPLOYEE.includes(claim.status),
      employeeName: emp.name,
      empCode: emp.empCode,
      level1Name: chain.level1Name,
      level2Name: chain.level2Name,
    },
  };
}

/** The bytes of one attachment, for viewing/downloading. */
export async function getClaimAttachment(attachmentId: string) {
  const u = await requireUser();
  if (!u?.id) return { success: false as const, error: "Not signed in." };

  const att = await prisma.hrClaimAttachment.findUnique({
    where: { id: attachmentId },
    select: { fileName: true, mimeType: true, data: true, claim: { select: { employeeId: true, status: true } } },
  });
  if (!att) return { success: false as const, error: "Attachment not found." };
  const access = await canReadClaim(u, att.claim);
  if (!access.ok) return { success: false as const, error: "Insufficient permissions" };
  return { success: true as const, data: { fileName: att.fileName, mimeType: att.mimeType, data: att.data } };
}

/** The legacy single bill (claims raised before multi-attachments), same access rule. */
export async function getClaimLegacyBill(claimId: string) {
  const u = await requireUser();
  if (!u?.id) return { success: false as const, error: "Not signed in." };
  const claim = await prisma.hrReimbursementClaim.findUnique({
    where: { id: claimId },
    select: { employeeId: true, status: true, billUrl: true },
  });
  if (!claim?.billUrl) return { success: false as const, error: "No bill on this claim." };
  const access = await canReadClaim(u, claim);
  if (!access.ok) return { success: false as const, error: "Insufficient permissions" };
  return { success: true as const, data: { data: claim.billUrl } };
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
    select: { employeeId: true, status: true, attachments: { select: { sizeBytes: true } } },
  });
  if (!claim) return { success: false, error: "Claim not found." };

  const me = await myEmployee(u.id);
  const isOwner = me?.id === claim.employeeId;
  const isHr = can(u.role, "hr:payroll");
  if (!isOwner && !isHr) return { success: false, error: "Insufficient permissions" };

  // Evidence must not change under an approval already given: once level 1
  // has signed off (PENDING_L2 onward) only HR may add to it.
  if (!EDITABLE_BY_EMPLOYEE.includes(claim.status) && !isHr) {
    return { success: false, error: `A claim that is ${claim.status.replaceAll("_", " ").toLowerCase()} can no longer be edited.` };
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

  revalidateAll();
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
    return { success: false, error: `A claim that is ${att.claim.status.replaceAll("_", " ").toLowerCase()} can no longer be edited.` };
  }

  await prisma.hrClaimAttachment.delete({ where: { id: attachmentId } });
  await recordClaimEvent(att.claimId, "EDITED", {
    from: att.claim.status, to: att.claim.status, actorId: u.id, actorName: u.name ?? null,
    note: `Removed attachment ${att.fileName}`,
  });

  revalidateAll();
  return { success: true, data: { id: attachmentId } };
}

/** The employee edits the details and sends it back — it restarts at level 1. */
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
    select: { employeeId: true, status: true, title: true, amount: true },
  });
  if (!claim) return { success: false, error: "Claim not found." };
  if (claim.employeeId !== me.id) return { success: false, error: "That isn't your claim." };
  if (!EDITABLE_BY_EMPLOYEE.includes(claim.status)) {
    return { success: false, error: `A claim that is ${claim.status.replaceAll("_", " ").toLowerCase()} can no longer be edited.` };
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

  // Back to level 1 so the chain re-validates what changed. Clearing
  // decisionNote matters: leaving "missing the hotel invoice" on a claim that
  // now HAS it makes the queue read as though the problem is outstanding.
  data.status = "PENDING";
  data.decisionNote = null;
  data.level1ById = null; data.level1At = null; data.level1Note = null;
  data.level2ById = null; data.level2At = null; data.level2Note = null;

  await prisma.hrReimbursementClaim.update({ where: { id: claimId }, data });
  await recordClaimEvent(claimId, "RESUBMITTED", {
    from: claim.status, to: "PENDING", actorId: u.id, actorName: u.name ?? null,
    note: "Employee updated the claim and sent it back for approval",
  });

  const approvers = await resolveClaimApprovers({ departmentId: me.departmentId });
  await notifyClaimStep(approvers.level1, {
    title: "Reimbursement claim resubmitted",
    body: `${describeClaim({ title: (data.title as string) ?? claim.title, amount: Number(data.amount ?? claim.amount), employeeName: `${me.firstName} ${me.lastName}`.trim() })} was updated and needs first-level approval again.`,
    actionUrl: "/me/approvals",
    claimId,
  });

  revalidateAll();
  return { success: true, data: { id: claimId } };
}
