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
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { isSafeReceiptUrl } from "@/lib/sales/receipt";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const ENTITY_ID = "BILLION";

export const REIMBURSEMENT_CATEGORIES = ["TRAVEL", "MEDICAL", "TELEPHONE", "FUEL", "BOOKS", "OTHER"] as const;
export type ReimbursementCategory = (typeof REIMBURSEMENT_CATEGORIES)[number];

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
