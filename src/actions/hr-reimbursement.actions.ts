"use server";

// ============================================================
// Employee expense reimbursements — IO layer.
// Lifecycle: employee SUBMITS (ESS) → the claim's approval chain, one stage at
// a time (e.g. reporting manager → HR → Venkat → Finance; chosen by
// lib/hr/claim-chain.ts and snapshotted on the claim) → APPROVED, now visible
// to Finance → Finance schedules it on a pay run (payroll disburses and stamps
// PAID) or records a direct payment → PAID. Every step writes an HrClaimEvent
// with actor + timestamp and notifies the employee and the next approver
// (in-app + email). Finance cannot see a claim before every stage is approved.
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
import { readFileValueAsDataUrl, storeIncomingFile } from "@/lib/storage/data-url";
import {
  REIMBURSEMENT_CATEGORIES,
  checkFuelCap,
  claimMonthBounds,
  type ReimbursementCategory,
} from "@/lib/hr/reimbursement";
import { AWAITING_STATUSES } from "@/lib/hr/claim-labels";
import { isEmployeeRouteScope } from "@/lib/hr/claim-routing";
import {
  MAX_STAGES,
  canActOnStage,
  chainSummary,
  eligibleApproverIds,
  eligibleStage,
  parseChain,
  parseRouteStages,
  stageHolder,
  statusForStage,
  type ChainStage,
  type RouteStage,
} from "@/lib/hr/claim-chain";
import {
  describeClaim,
  ensureClaimChain,
  financeRecipients,
  notifyClaimStep,
  resolveClaimChain,
  usersByIds,
  type ApproverUser,
  type ClaimChainState,
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
  level3At: Date | null; level3Note: string | null;
  paymentRef: string | null;
};
const serialize = (r: ClaimRow) => ({
  id: r.id, employeeId: r.employeeId, category: r.category, title: r.title, amount: Number(r.amount),
  taxable: r.taxable, claimDate: r.claimDate, hasBill: !!r.billUrl, note: r.note, status: r.status,
  decisionNote: r.decisionNote, payFy: r.payFy, payMonth: r.payMonth, runId: r.runId, paidAt: r.paidAt,
  createdAt: r.createdAt,
  level1At: r.level1At, level1Note: r.level1Note, level2At: r.level2At, level2Note: r.level2Note,
  level3At: r.level3At, level3Note: r.level3Note,
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

/** Fields every chain-aware read needs from a claim. */
const CHAIN_FIELDS = {
  id: true, employeeId: true, status: true, category: true, title: true, amount: true,
  approvalChain: true, stageIndex: true, updatedAt: true,
  level1ById: true, level1At: true, level1Note: true, level2ById: true, level2At: true, level2Note: true,
} as const;

const AWAITING: string[] = [...AWAITING_STATUSES];

/**
 * Where a claim stands, in words, from its chain: the stage it waits at, who
 * holds it, and the whole route. The same chain the approvals use, so what an
 * employee is told always matches who can actually act.
 */
function trackerFields(state: ClaimChainState) {
  const st = state.stageIndex != null ? eligibleStage(state.chain, state.stageIndex) : undefined;
  const next = state.stageIndex != null ? state.chain[state.stageIndex + 1] : undefined;
  return {
    status: state.status,
    stageIndex: state.stageIndex,
    /** Echoed back with a decision, so a stale screen can't act on a claim that has moved. */
    version: state.updatedAt ? state.updatedAt.toISOString() : null,
    stage: st?.label ?? null,
    /** "Final approval with Amrutha" — where an approval here sends it; null at the last stage. */
    nextStep: next ? `${next.label.toLowerCase()} with ${stageHolder(next)}` : null,
    awaitingName: st ? stageHolder(st) : null,
    statusLabel: st ? `Awaiting ${st.label.toLowerCase()}` : null,
    route: state.chain.length ? chainSummary(state.chain) : null,
  };
}

/**
 * The row as of `state`. Attaching a chain to a pre-chain claim (or a change
 * racing the list) can move the row after the list read it; then the amount
 * and title shown must come from a fresh read, never from the stale one beside
 * a newer version — or an approver could approve an amount they never saw.
 */
async function freshRow<T extends { id: string; updatedAt: Date }>(r: T, state: ClaimChainState, reread: () => Promise<T | null>): Promise<T> {
  if (!state.updatedAt || state.updatedAt.getTime() === r.updatedAt.getTime()) return r;
  return (await reread()) ?? r;
}

/**
 * Tell the employee their claim moved. Every message carries the same three
 * facts: the stage it is at, who holds it, and whether it is pending, approved,
 * rejected or paid. Best-effort, like every other claim notification.
 */
async function notifyOwner(employeeId: string, claimId: string, title: string, body: string) {
  const owner = await employeeUser(employeeId);
  if (!owner) return;
  await notifyClaimStep([owner], { title, body, actionUrl: "/me/reimbursements", claimId });
}

/** Fuel already claimed by this employee in the claim's month (excluding one claim). */
async function fuelClaimedInMonth(
  db: Prisma.TransactionClient | typeof prisma,
  employeeId: string,
  claimDate: Date,
  excludeClaimId?: string,
): Promise<number> {
  const { from, to } = claimMonthBounds(claimDate);
  const agg = await db.hrReimbursementClaim.aggregate({
    _sum: { amount: true },
    where: {
      employeeId,
      category: "FUEL",
      claimDate: { gte: from, lte: to },
      // Withdrawn claims are stored as REJECTED, so this excludes both.
      status: { notIn: ["REJECTED"] },
      ...(excludeClaimId ? { id: { not: excludeClaimId } } : {}),
    },
  });
  return Number(agg._sum.amount ?? 0);
}

/** Thrown inside a transaction to abort it with an employee-facing message. */
class FuelCapError extends Error {}

/**
 * Serialise fuel claims per employee for the rest of the transaction, so two
 * claims submitted at the same moment cannot both pass the monthly check.
 */
async function lockFuelCap(tx: Prisma.TransactionClient, employeeId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${"fuel-cap:" + employeeId}))`;
}

// ============================================================
// Employee self-service (ESS) — strictly own-record
// ============================================================
export interface SubmitReimbursementInput {
  category: string;
  title: string;
  amount: number;
  fuelLiters?: number;
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
  
  // Fuel: litres are still recorded, but the LIMIT is the employee's monthly
  // rupee cap (Employee.fuelMonthlyCap; null = no cap). It replaced the old
  // company-wide 50-litre rule so two limits can never disagree.
  let fuelLiters: Prisma.Decimal | null = null;
  let fuelCap: number | null = null;
  if (category === "FUEL") {
    if (!input.fuelLiters || input.fuelLiters <= 0) {
      return { success: false, error: "Liters are required for fuel claims." };
    }
    fuelLiters = new Prisma.Decimal(Number(input.fuelLiters).toFixed(2));
    const capRow = await prisma.employee.findUnique({ where: { id: me.id }, select: { fuelMonthlyCap: true } });
    fuelCap = capRow?.fuelMonthlyCap != null ? Number(capRow.fuelMonthlyCap) : null;
    // Fast check before any file is stored; repeated under a lock below.
    const pre = checkFuelCap({ cap: fuelCap, alreadyClaimed: await fuelClaimedInMonth(prisma, me.id, claim), amount });
    if (!pre.ok) return { success: false, error: pre.message };
  }

  if (input.billUrl && !isSafeReceiptUrl(input.billUrl)) return { success: false, error: "That receipt file isn't a supported image/PDF." };
  // Validated above. With object storage enabled the bill goes to the bucket
  // and the column holds the ref; otherwise the data-URL is stored inline as
  // before (an https reference passes through either way).
  const billUrl = input.billUrl
    ? await storeIncomingFile(input.billUrl, { prefix: "hr/claims", ownerType: "HrReimbursementClaim", createdById: u.id })
    : null;

  // The route this claim will follow, fixed now so a later team change can't
  // re-route it halfway (claim-chain.ts).
  const chain = await resolveClaimChain(me.id, category);

  let created: { id: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      if (category === "FUEL" && fuelCap != null) {
        await lockFuelCap(tx, me.id);
        const check = checkFuelCap({ cap: fuelCap, alreadyClaimed: await fuelClaimedInMonth(tx, me.id, claim), amount });
        if (!check.ok) throw new FuelCapError(check.message);
      }
      return tx.hrReimbursementClaim.create({
        data: {
          entityId: ENTITY_ID,
          employeeId: me.id,
          category,
          title,
          amount: new Prisma.Decimal(amount.toFixed(2)),
          fuelLiters,
          claimDate: claim,
          billUrl,
          note: input.note?.trim() || null,
          createdById: u.id,
          approvalChain: chain as unknown as Prisma.InputJsonValue,
          stageIndex: 0,
        },
        select: { id: true },
      });
    });
  } catch (e) {
    if (e instanceof FuelCapError) return { success: false, error: e.message };
    throw e;
  }
  await recordClaimEvent(created.id, "SUBMITTED", {
    from: null, to: "PENDING", actorId: u.id, actorName: u.name ?? null,
    note: `Approval route: ${chainSummary(chain)}`,
  });

  // The first approver is told immediately, and the employee learns where
  // their claim is and with whom.
  const first = chain[0];
  await notifyClaimStep(await usersByIds(first.approverIds), {
    title: "Reimbursement claim awaiting your approval",
    body: `${describeClaim({ title, amount, employeeName: `${me.firstName} ${me.lastName}`.trim() })} needs your ${first.label.toLowerCase()}.`,
    actionUrl: "/me/approvals",
    claimId: created.id,
  });
  await notifyOwner(me.id, created.id, "Reimbursement claim submitted",
    `Your claim "${title}" was submitted. Route: ${chainSummary(chain)}. Status: Pending — ${first.label} with ${stageHolder(first)}.`);

  revalidateAll();
  return { success: true, data: { id: created.id } };
}

export async function listMyReimbursements() {
  const u = await requireUser();
  if (!u?.id) return [];
  const me = await myEmployee(u.id);
  if (!me) return [];
  const rows = await prisma.hrReimbursementClaim.findMany({ where: { employeeId: me.id }, orderBy: { createdAt: "desc" } });
  const out = [];
  for (const r of rows) {
    // Where the claim is now and who holds it, for the employee's tracker.
    const state = await ensureClaimChain(r);
    const row = await freshRow(r, state, () => prisma.hrReimbursementClaim.findUnique({ where: { id: r.id } }));
    out.push({ ...serialize(row), ...trackerFields(state) });
  }
  return out;
}

/** Withdraw own claim — while it is still awaiting an approval. */
export async function cancelMyReimbursement(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const me = await myEmployee(u.id);
  if (!me) return { success: false, error: "No employee record." };

  const before = await prisma.hrReimbursementClaim.findFirst({ where: { id, employeeId: me.id }, select: CHAIN_FIELDS });
  if (!before) return { success: false, error: "Claim not found." };
  if (!AWAITING.includes(before.status)) return { success: false, error: "Only a claim still awaiting approval can be withdrawn." };
  // Pinned to the state read, so the notice below goes to the stage it was really at.
  const claimed = await prisma.hrReimbursementClaim.updateMany({
    where: { id, employeeId: me.id, status: before.status, stageIndex: before.stageIndex, updatedAt: before.updatedAt },
    data: { status: "REJECTED", decisionNote: "Withdrawn by employee" },
  });
  if (claimed.count === 0) return { success: false, error: "This claim just changed — refresh and try again." };
  await recordClaimEvent(id, "WITHDRAWN", { from: before.status, to: "REJECTED", actorId: u.id, actorName: u.name ?? null });

  // The approver it was waiting on is told it is gone, and the employee gets
  // the same confirmation as for every other status change.
  const chain = parseChain(before.approvalChain);
  const stage = chain && before.stageIndex != null ? eligibleStage(chain, before.stageIndex) : undefined;
  if (stage) {
    await notifyClaimStep(await usersByIds(stage.approverIds), {
      title: "Reimbursement claim withdrawn",
      body: `${describeClaim({ title: before.title, amount: Number(before.amount), employeeName: `${me.firstName} ${me.lastName}`.trim() })} was withdrawn by the employee at ${stage.label.toLowerCase()}. No action is needed.`,
      actionUrl: "/me/approvals",
      claimId: id,
    });
  }
  await notifyOwner(me.id, id, "Reimbursement claim withdrawn",
    `You withdrew your claim "${before.title}"${stage ? ` at ${stage.label.toLowerCase()}` : ""}. Status: Withdrawn — it will not be paid.`);
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
    select: { id: true, firstName: true, lastName: true, empCode: true },
  });
  const byId = new Map(emps.map((e) => [e.id, e]));
  const out = [];
  for (const r of rows) {
    const e = byId.get(r.employeeId);
    const state = await ensureClaimChain(r);
    const row = await freshRow(r, state, () => prisma.hrReimbursementClaim.findUnique({ where: { id: r.id } }));
    out.push({
      ...serialize(row),
      ...trackerFields(state),
      empCode: e?.empCode ?? "—",
      name: `${e?.firstName ?? ""} ${e?.lastName ?? ""}`.trim() || "Unknown",
    });
  }
  return out;
}

export async function reimbursementStats() {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { pending: 0, approved: 0, paidThisRunable: 0, pendingAmount: 0 };
  const rows = await prisma.hrReimbursementClaim.findMany({
    where: { entityId: ENTITY_ID, status: { in: [...AWAITING, "APPROVED"] } },
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
// Approvals — one stage at a time, along the claim's chain
// ============================================================
export interface DecideReimbursementInput {
  decision: "APPROVED" | "REJECTED";
  note?: string;
  /** The stage the approver was shown (0-based). A mismatch means the claim moved. */
  expectedStage?: number | null;
  /** The claim's version (updatedAt) the approver was shown. */
  version?: string | null;
}

/** Did the screen the approver acted from show the claim as it is now? */
function staleError(state: ClaimChainState, expected: { expectedStage?: number | null; version?: string | null }) {
  const moved =
    (expected.expectedStage != null && expected.expectedStage !== state.stageIndex) ||
    (!!expected.version && !!state.updatedAt && expected.version !== state.updatedAt.toISOString());
  return moved ? "This claim has changed since you opened it — refresh to see where it is now." : null;
}

/** canActOnStage (claim-chain.ts) for a signed-in user. */
function canAct(u: { id: string; role?: string }, chain: ChainStage[], idx: number, claimantUserId: string | null) {
  return canActOnStage({ id: u.id, superAdmin: isSuperAdmin(u.role) }, chain, idx, claimantUserId);
}

/**
 * The one decision path for every stage. The stage comes from the claim's
 * chain; approving moves it to the next stage (its approvers and the employee
 * are told), approving the last stage sends it to Finance for payment, and a
 * rejection at any stage closes it. The update is guarded on status AND stage,
 * so two approvers clicking at once cannot both move it.
 */
export async function decideReimbursement(
  id: string,
  input: DecideReimbursementInput,
): Promise<Result<{ id: string; status: string; nextStage: string | null; nextHolder: string | null }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };

  const claim = await prisma.hrReimbursementClaim.findUnique({ where: { id }, select: CHAIN_FIELDS });
  if (!claim) return { success: false, error: "Claim not found." };
  if (!AWAITING.includes(claim.status)) return { success: false, error: "This claim is not awaiting approval." };

  const state = await ensureClaimChain(claim);
  const idx = state.stageIndex;
  const stage = idx != null ? state.chain[idx] : undefined;
  if (idx == null || !stage) return { success: false, error: "This claim's approval route could not be worked out — ask HR to check the approvers page." };

  const stale = staleError(state, input);
  if (stale) return { success: false, error: stale };

  const emp = await employeeBrief(claim.employeeId);
  const access = canAct(u, state.chain, idx, emp.userId);
  if (!access.ok) return { success: false, error: access.error ?? "Insufficient permissions" };

  const note = input.note?.trim() || null;
  const now = new Date();
  const actor = u.name ?? "the approver";
  const summary = describeClaim({ title: claim.title, amount: Number(claim.amount), employeeName: emp.name });
  const last = idx === state.chain.length - 1;
  const onBehalf = access.onBehalf ? ` (Super Admin, for ${stageHolder(eligibleStage(state.chain, idx))})` : "";
  const decided: ChainStage = { ...stage, decidedById: u.id, decidedByName: u.name ?? null, decidedAt: now.toISOString(), note };
  const chainAfter = state.chain.map((st, i) => (i === idx ? decided : st));
  // The legacy level columns keep their old meaning: 1st, 2nd, and final.
  const levelCols = last
    ? { level3ById: u.id, level3At: now, level3Note: note }
    : idx === 0 ? { level1ById: u.id, level1At: now, level1Note: note }
    : idx === 1 ? { level2ById: u.id, level2At: now, level2Note: note }
    : {};

  if (input.decision === "REJECTED") {
    const upd = await prisma.hrReimbursementClaim.updateMany({
      where: { id, status: state.status, stageIndex: idx, ...(state.updatedAt ? { updatedAt: state.updatedAt } : {}) },
      data: {
        status: "REJECTED", decidedById: u.id, decidedAt: now, decisionNote: note,
        approvalChain: chainAfter as unknown as Prisma.InputJsonValue, ...levelCols,
      },
    });
    if (upd.count === 0) return { success: false, error: "This claim was already decided." };
    await recordClaimEvent(id, "REJECTED", {
      from: state.status, to: "REJECTED", actorId: u.id, actorName: u.name ?? null,
      note: `${stage.label}${onBehalf}${note ? ` — ${note}` : ""}`,
    });
    await prisma.activityLog.create({
      data: { action: "REIMBURSEMENT_REJECTED", entityType: "EMPLOYEE", entityId: claim.employeeId, userId: u.id, changes: { reimbursementId: id, stage: idx + 1 } },
    });
    await notifyOwner(claim.employeeId, id, "Reimbursement claim rejected",
      `Your claim "${claim.title}" was rejected by ${actor} at ${stage.label.toLowerCase()}${note ? `: ${note}` : "."} Status: Rejected.`);
    revalidateAll();
    return { success: true, data: { id, status: "REJECTED", nextStage: null, nextHolder: null } };
  }

  const nextIdx = last ? idx : idx + 1;
  const nextStatus = last ? "APPROVED" : statusForStage(nextIdx);
  const upd = await prisma.hrReimbursementClaim.updateMany({
    where: { id, status: state.status, stageIndex: idx, ...(state.updatedAt ? { updatedAt: state.updatedAt } : {}) },
    data: {
      status: nextStatus,
      stageIndex: nextIdx,
      approvalChain: chainAfter as unknown as Prisma.InputJsonValue,
      ...levelCols,
      ...(last ? { decidedById: u.id, decidedAt: now, decisionNote: note } : {}),
    },
  });
  if (upd.count === 0) return { success: false, error: "This claim was already decided." };
  await recordClaimEvent(id, "STAGE_APPROVED", {
    from: state.status, to: nextStatus, actorId: u.id, actorName: u.name ?? null,
    note: `${stage.label}${onBehalf}${note ? ` — ${note}` : ""}`,
  });

  if (!last) {
    // The next stage's approvers as of now — without anyone who has just
    // approved an earlier stage — so the notice goes to who can actually act.
    const next = eligibleStage(chainAfter, nextIdx)!;
    await notifyOwner(claim.employeeId, id, `Claim approved at ${stage.label.toLowerCase()}`,
      `Your claim "${claim.title}" was approved by ${actor} (${stage.label.toLowerCase()}). Status: Pending — ${next.label} with ${stageHolder(next)}.`);
    await notifyClaimStep(await usersByIds(next.approverIds), {
      title: "Reimbursement claim awaiting your approval",
      body: `${summary} was approved by ${actor} (${stage.label.toLowerCase()}) and now needs your ${next.label.toLowerCase()}.`,
      actionUrl: "/me/approvals",
      claimId: id,
    });
    revalidateAll();
    return { success: true, data: { id, status: nextStatus, nextStage: next.label, nextHolder: stageHolder(next) } };
  }

  await prisma.activityLog.create({
    data: { action: "REIMBURSEMENT_APPROVED", entityType: "EMPLOYEE", entityId: claim.employeeId, userId: u.id, changes: { reimbursementId: id, stage: idx + 1 } },
  });
  await notifyClaimStep(await financeRecipients(), {
    title: "Reimbursement approved — ready for payment",
    body: `${summary} has completed every approval and is ready for Finance to pay.`,
    actionUrl: "/finance/reimbursements",
    claimId: id,
  });
  await notifyOwner(claim.employeeId, id, "Reimbursement claim approved",
    `Your claim "${claim.title}" received its final approval from ${actor}. Status: Approved — with Finance for payment. You will be told when it is paid.`);
  revalidateAll();
  return { success: true, data: { id, status: "APPROVED", nextStage: null, nextHolder: null } };
}

export async function listMyApprovals() {
  const u = await requireUser();
  if (!u?.id) return [];
  const rows = await prisma.hrReimbursementClaim.findMany({
    where: { entityId: ENTITY_ID, status: { in: AWAITING } },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { attachments: true } } },
  });
  if (rows.length === 0) return [];
  const emps = await prisma.employee.findMany({
    where: { id: { in: Array.from(new Set(rows.map((r) => r.employeeId))) } },
    select: { id: true, firstName: true, lastName: true, empCode: true, department: { select: { name: true } } },
  });
  const byId = new Map(emps.map((e) => [e.id, e]));

  // Only the claims whose CURRENT stage names this user. A Super Admin can
  // still step in from the HR overview, but their queue is what is theirs —
  // otherwise every claim at every stage would sit in it.
  const out = [];
  for (const r of rows) {
    const state = await ensureClaimChain(r);
    const idx = state.stageIndex;
    if (idx == null || !state.chain[idx] || !eligibleApproverIds(state.chain, idx).includes(u.id)) continue;
    const row = await freshRow(r, state, () =>
      prisma.hrReimbursementClaim.findUnique({ where: { id: r.id }, include: { _count: { select: { attachments: true } } } }));
    const e = byId.get(r.employeeId);
    const previous = idx > 0 ? state.chain[idx - 1] : undefined;
    out.push({
      ...serialize(row),
      ...trackerFields(state),
      stageNumber: (idx ?? 0) + 1,
      stageCount: state.chain.length,
      previousApproval: previous?.decidedAt ? { label: previous.label, by: previous.decidedByName, at: previous.decidedAt } : null,
      attachmentCount: row._count.attachments + (row.billUrl ? 1 : 0),
      empCode: e?.empCode ?? "—",
      name: `${e?.firstName ?? ""} ${e?.lastName ?? ""}`.trim() || "Unknown",
      department: e?.department?.name ?? null,
    });
  }
  return out;
}

/** Send a claim back to the employee for missing information. */
export async function requestClaimInfo(
  claimId: string,
  note: string,
  expected: { expectedStage?: number | null; version?: string | null } = {},
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };

  const reason = (note ?? "").trim();
  if (!reason) return { success: false, error: "Say what is missing — the employee has to know what to add." };

  const claim = await prisma.hrReimbursementClaim.findUnique({ where: { id: claimId }, select: CHAIN_FIELDS });
  if (!claim) return { success: false, error: "Claim not found." };
  if (!AWAITING.includes(claim.status)) {
    return { success: false, error: `Only a claim awaiting approval can be sent back (this one is ${claim.status.toLowerCase()}).` };
  }
  const state = await ensureClaimChain(claim);
  const stage = state.stageIndex != null ? state.chain[state.stageIndex] : undefined;
  const stale = staleError(state, expected);
  if (stale) return { success: false, error: stale };

  // HR, the current stage's approver, or an admin may send it back.
  const mayAct = state.stageIndex != null && eligibleApproverIds(state.chain, state.stageIndex).includes(u.id);
  if (!can(u.role, "hr:payroll") && !isSuperAdmin(u.role) && !mayAct) {
    return { success: false, error: "Insufficient permissions" };
  }

  const upd = await prisma.hrReimbursementClaim.updateMany({
    where: {
      id: claimId, status: state.status, stageIndex: state.stageIndex,
      ...(state.updatedAt ? { updatedAt: state.updatedAt } : {}),
    },
    data: { status: "NEEDS_INFO", decisionNote: reason },
  });
  if (upd.count === 0) return { success: false, error: "This claim was already decided." };
  await recordClaimEvent(claimId, "INFO_REQUESTED", {
    from: state.status, to: "NEEDS_INFO", note: reason, actorId: u.id, actorName: u.name ?? null,
  });
  await notifyOwner(claim.employeeId, claimId, "Your reimbursement claim needs more information",
    `"${claim.title}" was sent back by ${u.name ?? "the approver"}${stage ? ` at ${stage.label.toLowerCase()}` : ""}: ${reason} Status: Needs your input — once you update it, it starts again from the 1st approval.`);

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
  const approverIds = Array.from(new Set(rows.flatMap((r) => [r.level1ById, r.level2ById, r.level3ById, r.decidedById]).filter(Boolean) as string[]));
  const approvers = approverIds.length
    ? await prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = (id: string | null) => (id ? approvers.find((a) => a.id === id)?.name ?? "—" : null);
  return rows.map((r) => {
    const e = byId.get(r.employeeId);
    // Every approval the claim received, in order — from its chain, or from the
    // level columns for claims decided before chains existed.
    const chain = parseChain(r.approvalChain);
    const approvals = chain
      ? chain.filter((st) => st.decidedAt).map((st) => ({ label: st.label, by: st.decidedByName ?? "—", at: st.decidedAt as string | Date | null }))
      : [
          { label: "1st approval", by: nameOf(r.level1ById), at: r.level1At },
          { label: "2nd approval", by: nameOf(r.level2ById), at: r.level2At },
          { label: "Final approval", by: nameOf(r.level3ById), at: r.level3At },
        ].filter((a) => a.at).map((a) => ({ label: a.label, by: a.by ?? "—", at: a.at as string | Date | null }));
    if (!chain && approvals.length === 0 && r.decidedAt) {
      approvals.push({ label: "Approved", by: nameOf(r.decidedById) ?? "—", at: r.decidedAt });
    }
    return {
      ...serialize(r),
      empCode: e?.empCode ?? "—",
      name: `${e?.firstName ?? ""} ${e?.lastName ?? ""}`.trim() || "Unknown",
      department: e?.department?.name ?? null,
      approvals,
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
  // A locked or paid run is frozen: a claim scheduled onto it would never be paid.
  const frozen = await prisma.hrPayrollRun.findFirst({
    where: { entityId: ENTITY_ID, fy: payFy, month: payMonth, status: { in: ["LOCKED", "PAID"] } },
    select: { status: true },
  });
  if (frozen) {
    return { success: false, error: `That month's payroll is already ${frozen.status.toLowerCase()} — pick a later month, or record a direct payment.` };
  }

  const upd = await prisma.hrReimbursementClaim.updateMany({
    where: { id, status: "APPROVED", runId: null },
    data: { payFy, payMonth, taxable: !!input.taxable },
  });
  if (upd.count === 0) {
    return { success: false, error: "Only a fully approved, unpaid claim that isn't already on a computed payroll can be scheduled." };
  }
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

  const claim = await prisma.hrReimbursementClaim.findUnique({ where: { id }, select: { status: true, employeeId: true, title: true, runId: true } });
  if (!claim) return { success: false, error: "Claim not found." };
  if (claim.status !== "APPROVED") return { success: false, error: "Only a fully approved, unpaid claim can be marked paid." };
  // On a computed payroll it is paid with that run; paying it here too would pay it twice.
  if (claim.runId) return { success: false, error: "This claim is on a computed payroll run — it is marked paid when that run is paid." };

  const paidAt = input.paidOn ? new Date(input.paidOn) : new Date();
  if (Number.isNaN(paidAt.getTime())) return { success: false, error: "Pick a valid payment date." };
  const reference = input.reference?.trim() || null;

  const upd = await prisma.hrReimbursementClaim.updateMany({
    where: { id, status: "APPROVED", runId: null },
    data: { status: "PAID", paidAt, paymentRef: reference },
  });
  if (upd.count === 0) return { success: false, error: "This claim was already paid." };
  await recordClaimEvent(id, "PAID", {
    from: "APPROVED", to: "PAID", actorId: u.id, actorName: u.name ?? null,
    note: [reference ? `Ref ${reference}` : null, input.note?.trim() || null].filter(Boolean).join(" · ") || null,
  });
  await notifyOwner(claim.employeeId, id, "Reimbursement paid",
    `Your claim "${claim.title}" was paid on ${paidAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}${reference ? ` (ref ${reference})` : ""}. Status: Paid — this claim is complete.`);
  revalidateAll();
  return { success: true, data: { id } };
}

// ============================================================
// Approver configuration (hr:admin)
// ============================================================
export async function getReimbursementApproverConfig() {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false as const, error: "Not authorized." };
  const [rules, routes, departments, candidates, employees, finance] = await Promise.all([
    prisma.hrReimbursementApprover.findMany(),
    prisma.hrReimbursementRoute.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { isActive: true, role: { notIn: ["CLIENT", "VENDOR"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.employee.findMany({
      where: { deletedAt: null, status: { not: "EXITED" } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true, firstName: true, lastName: true, empCode: true, fuelMonthlyCap: true, reportingManagerId: true,
        department: { select: { name: true } },
      },
    }),
    financeRecipients(),
  ]);
  // Old per-employee level rules ("EMP:<id>") are superseded by routes and ignored.
  const deptRules = rules.filter((r) => !isEmployeeRouteScope(r.scope));
  const reportCount = new Map<string, number>();
  for (const e of employees) {
    if (e.reportingManagerId) reportCount.set(e.reportingManagerId, (reportCount.get(e.reportingManagerId) ?? 0) + 1);
  }
  return {
    success: true as const,
    data: {
      level1UserId: deptRules.find((r) => r.level === 1 && r.scope === "ALL")?.userId ?? null,
      level2Default: deptRules.find((r) => r.level === 2 && r.scope === "ALL")?.userId ?? null,
      // Department rules only — the event pool is not a department.
      level2ByDepartment: Object.fromEntries(
        deptRules
          .filter((r) => r.level === 2 && r.scope !== "ALL" && r.scope !== "CATEGORY_EVENT")
          .map((r) => [r.scope, r.userId])
      ) as Record<string, string>,
      routes: routes.map((r) => ({
        id: r.id,
        kind: r.kind as "EMPLOYEE" | "TEAM",
        subjectEmployeeId: r.subjectEmployeeId,
        stages: parseRouteStages(r.stages),
      })),
      employees: employees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`.trim(),
        empCode: e.empCode,
        department: e.department?.name ?? null,
        fuelMonthlyCap: e.fuelMonthlyCap != null ? Number(e.fuelMonthlyCap) : null,
        reportingManagerId: e.reportingManagerId,
        reportCount: reportCount.get(e.id) ?? 0,
      })),
      financeName: finance.map((f) => f.name ?? f.email).join(" / ") || "Finance",
      departments,
      candidates,
    },
  };
}

export async function setReimbursementApprover(input: {
  level: 1 | 2;
  /** "ALL", or a departmentId (level 2). */
  scope: string;
  userId: string | null; // null clears the rule
}): Promise<Result<{ ok: true }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const level = input.level === 2 ? 2 : 1;
  const requested = input.scope || "ALL";
  if (isEmployeeRouteScope(requested)) return { success: false, error: "Set a named person's approvers as a route instead." };
  const scope = level === 1 ? "ALL" : requested;
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

/**
 * Create or replace a route. EMPLOYEE = that person's own claims; TEAM = the
 * claims of everyone who reports to that person. Applies to claims submitted
 * (or resubmitted) from now on — claims in flight keep the route they have.
 */
export async function setReimbursementRoute(input: {
  kind: "EMPLOYEE" | "TEAM";
  subjectEmployeeId: string;
  stages: RouteStage[];
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  if (input.kind !== "EMPLOYEE" && input.kind !== "TEAM") return { success: false, error: "Pick whose claims this route is for." };
  const subject = await prisma.employee.findFirst({ where: { id: input.subjectEmployeeId, deletedAt: null }, select: { id: true } });
  if (!subject) return { success: false, error: "That employee no longer exists." };

  const stages = parseRouteStages(input.stages);
  if (stages.length === 0) return { success: false, error: "Add at least one approval stage." };
  if (Array.isArray(input.stages) && input.stages.length > MAX_STAGES) return { success: false, error: `A route can have at most ${MAX_STAGES} stages.` };
  if (Array.isArray(input.stages) && stages.length !== input.stages.length) return { success: false, error: "Pick an approver for every stage." };
  const named = stages.flatMap((st) => (st.type === "USER" ? [st.userId] : []));
  if (named.length) {
    const ok = await prisma.user.count({ where: { id: { in: named }, isActive: true, role: { notIn: ["CLIENT", "VENDOR"] } } });
    if (ok !== new Set(named).size) return { success: false, error: "Every named approver must be an active staff login." };
  }

  const row = await prisma.hrReimbursementRoute.upsert({
    where: { kind_subjectEmployeeId: { kind: input.kind, subjectEmployeeId: subject.id } },
    update: { stages: stages as unknown as Prisma.InputJsonValue },
    create: { kind: input.kind, subjectEmployeeId: subject.id, stages: stages as unknown as Prisma.InputJsonValue, createdById: u!.id },
    select: { id: true },
  });
  await prisma.activityLog.create({
    data: { action: "REIMBURSEMENT_ROUTE_SET", entityType: "HR_CONFIG", entityId: `${input.kind}:${subject.id}`, userId: u!.id, changes: { stages } as unknown as Prisma.InputJsonValue },
  });
  revalidatePath("/people/payroll/reimbursements/approvers");
  return { success: true, data: { id: row.id } };
}

/** Remove a route; those claims go back to the next rule that applies. */
export async function deleteReimbursementRoute(id: string): Promise<Result<{ ok: true }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const row = await prisma.hrReimbursementRoute.findUnique({ where: { id }, select: { kind: true, subjectEmployeeId: true, stages: true } });
  if (!row) return { success: true, data: { ok: true } };
  await prisma.hrReimbursementRoute.delete({ where: { id } });
  await prisma.activityLog.create({
    data: { action: "REIMBURSEMENT_ROUTE_REMOVED", entityType: "HR_CONFIG", entityId: `${row.kind}:${row.subjectEmployeeId}`, userId: u!.id, changes: { stages: row.stages ?? null } as unknown as Prisma.InputJsonValue },
  });
  revalidatePath("/people/payroll/reimbursements/approvers");
  return { success: true, data: { ok: true } };
}

/** Set or clear one employee's monthly fuel cap (rupees). */
export async function setEmployeeFuelCap(input: { employeeId: string; cap: number | null }): Promise<Result<{ ok: true }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  let cap: Prisma.Decimal | null = null;
  if (input.cap != null) {
    const n = Number(input.cap);
    if (!Number.isFinite(n) || n <= 0) return { success: false, error: "The cap must be a positive amount." };
    if (n > 100000) return { success: false, error: "That cap looks too high — enter a monthly amount up to ₹1,00,000." };
    cap = new Prisma.Decimal(n.toFixed(2));
  }
  const emp = await prisma.employee.findFirst({ where: { id: input.employeeId, deletedAt: null }, select: { id: true, fuelMonthlyCap: true } });
  if (!emp) return { success: false, error: "That employee no longer exists." };
  await prisma.employee.update({ where: { id: emp.id }, data: { fuelMonthlyCap: cap } });
  await prisma.activityLog.create({
    data: {
      action: "REIMBURSEMENT_FUEL_CAP_SET", entityType: "EMPLOYEE", entityId: emp.id, userId: u!.id,
      changes: { from: emp.fuelMonthlyCap != null ? Number(emp.fuelMonthlyCap) : null, to: input.cap },
    },
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
async function canReadClaim(
  u: { id: string; role?: string },
  claim: { employeeId: string; status: string; approvalChain?: Prisma.JsonValue | null; level1ById?: string | null; level2ById?: string | null; level3ById?: string | null },
) {
  const me = await myEmployee(u.id);
  if (me?.id === claim.employeeId) return { ok: true, isOwner: true, isHr: can(u.role, "hr:payroll") };
  const isHr = can(u.role, "hr:payroll");
  if (isHr || isSuperAdmin(u.role) || can(u.role, "finance:read")) return { ok: true, isOwner: false, isHr };
  // Anyone on this claim's route — before, at or after their stage — so the
  // bills stay open to them for as long as the claim exists.
  const chain = parseChain(claim.approvalChain ?? null) ?? (await resolveClaimChain(claim.employeeId));
  const onRoute =
    chain.some((st) => st.approverIds.includes(u.id) || st.decidedById === u.id) ||
    [claim.level1ById, claim.level2ById, claim.level3ById].includes(u.id);
  return { ok: onRoute, isOwner: false, isHr };
}

/** One stage of the trail, as the History dialog shows it. */
export interface ClaimTrailStage {
  label: string;
  /** "Reporting manager", "Finance" — omitted when it would just repeat the name. */
  role: string | null;
  holder: string;
  state: "done" | "current" | "waiting" | "rejected" | "returned";
  by: string | null;
  at: Date | string | null;
  note: string | null;
}

/**
 * The stages of a claim's route with what happened at each. Claims decided
 * before chains existed have no snapshot: their trail is rebuilt from the
 * level columns, which is exactly what happened to them.
 */
async function trailStages(claim: {
  status: string; stageIndex: number | null; approvalChain: Prisma.JsonValue | null; decisionNote: string | null;
  decidedAt: Date | null; decidedById: string | null;
  level1ById: string | null; level1At: Date | null; level1Note: string | null;
  level2ById: string | null; level2At: Date | null; level2Note: string | null;
  level3ById: string | null; level3At: Date | null; level3Note: string | null;
}, returnedBy: string | null): Promise<ClaimTrailStage[]> {
  const chain = parseChain(claim.approvalChain);
  if (chain) {
    const at = claim.stageIndex;
    return chain.map((st, i) => {
      const holder = stageHolder(st);
      const done = !!st.decidedAt && !(claim.status === "REJECTED" && i === at);
      let state: ClaimTrailStage["state"] = done ? "done" : "waiting";
      // A rejection is recorded on the stage; a withdrawal is not (it shows in History).
      if (i === at && claim.status === "REJECTED" && st.decidedAt) state = "rejected";
      else if (i === at && claim.status === "NEEDS_INFO") state = "returned";
      else if (i === at && AWAITING.includes(claim.status)) state = "current";
      return {
        label: st.label,
        role: st.role && st.role !== holder ? st.role : null,
        holder,
        state,
        // Who actually sent it back (HR or an admin may, not only the holder).
        by: state === "returned" ? returnedBy : st.decidedByName ?? null,
        at: st.decidedAt ?? null,
        note: state === "returned" ? claim.decisionNote : st.note ?? null,
      };
    });
  }
  // Pre-chain claims: only the decisions actually recorded. The old flow wrote
  // the level columns on a rejection too, at the same instant as decidedAt, so
  // the stage carrying that timestamp is the one that rejected it.
  const ids = [claim.level1ById, claim.level2ById, claim.level3ById, claim.decidedById].filter(Boolean) as string[];
  const users = await usersByIds(ids);
  const nameOf = (id: string | null) => (id ? users.find((x) => x.id === id)?.name ?? "—" : null);
  const rejectedAt = claim.status === "REJECTED" && claim.decidedAt ? claim.decidedAt.getTime() : null;
  const recorded = [
    { label: "1st approval", by: claim.level1ById, at: claim.level1At, note: claim.level1Note },
    { label: "2nd approval", by: claim.level2ById, at: claim.level2At, note: claim.level2Note },
    { label: "Final approval", by: claim.level3ById, at: claim.level3At, note: claim.level3Note },
  ]
    .filter((l) => l.at)
    .map((l) => ({
      label: l.label,
      role: null,
      holder: nameOf(l.by) ?? "—",
      state: rejectedAt != null && l.at!.getTime() === rejectedAt ? ("rejected" as const) : ("done" as const),
      by: nameOf(l.by),
      at: l.at,
      note: l.note,
    }));
  // The original single-step flow recorded only decidedBy/decidedAt — show that
  // decision rather than nothing (a withdrawal has no decider and is in History).
  const decisionShown = claim.decidedAt != null && recorded.some((st) => st.at!.getTime() === claim.decidedAt!.getTime());
  if (!decisionShown && claim.decidedAt && claim.decidedById) {
    recorded.push({
      label: "Decision",
      role: null,
      holder: nameOf(claim.decidedById) ?? "—",
      state: claim.status === "REJECTED" ? ("rejected" as const) : ("done" as const),
      by: nameOf(claim.decidedById),
      at: claim.decidedAt,
      note: claim.decisionNote,
    });
  }
  return recorded;
}

/** Attachments + full history for one claim. */
export async function getClaimDetail(claimId: string) {
  const u = await requireUser();
  if (!u?.id) return { success: false as const, error: "Not signed in." };

  const found = await prisma.hrReimbursementClaim.findUnique({
    where: { id: claimId },
    select: {
      id: true, employeeId: true, status: true, title: true, amount: true,
      category: true, claimDate: true, note: true, decisionNote: true, billUrl: true,
      approvalChain: true, stageIndex: true, updatedAt: true, decidedAt: true, decidedById: true,
      level1ById: true, level1At: true, level1Note: true, level2ById: true, level2At: true, level2Note: true,
      level3ById: true, level3At: true, level3Note: true,
      payFy: true, payMonth: true, paidAt: true, paymentRef: true, runId: true,
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!found) return { success: false as const, error: "Claim not found." };

  const access = await canReadClaim(u, found);
  if (!access.ok) return { success: false as const, error: "Insufficient permissions" };

  // A pre-chain claim still in flight gets its chain here like anywhere else.
  const state = await ensureClaimChain(found);
  const claim = { ...found, status: state.status, stageIndex: state.stageIndex ?? found.stageIndex, approvalChain: state.chain.length ? (state.chain as unknown as Prisma.JsonValue) : found.approvalChain };
  const emp = await employeeBrief(claim.employeeId);

  return {
    success: true as const,
    data: {
      // Picked, not spread: the bill column can hold a whole data-URL, and the
      // chain snapshot is shown through `stages`.
      id: claim.id, employeeId: claim.employeeId, title: claim.title, category: claim.category,
      claimDate: claim.claimDate, note: claim.note, decisionNote: claim.decisionNote,
      payFy: claim.payFy, payMonth: claim.payMonth, paidAt: claim.paidAt, paymentRef: claim.paymentRef, runId: claim.runId,
      attachments: claim.attachments, events: claim.events,
      amount: Number(claim.amount),
      hasLegacyBill: !!claim.billUrl,
      canEdit: access.isOwner && EDITABLE_BY_EMPLOYEE.includes(claim.status),
      employeeName: emp.name,
      empCode: emp.empCode,
      ...trackerFields(state),
      stages: await trailStages(claim, [...claim.events].reverse().find((e) => e.action === "INFO_REQUESTED")?.actorName ?? null),
    },
  };
}

/** The bytes of one attachment, for viewing/downloading. */
export async function getClaimAttachment(attachmentId: string) {
  const u = await requireUser();
  if (!u?.id) return { success: false as const, error: "Not signed in." };

  const att = await prisma.hrClaimAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      fileName: true, mimeType: true, data: true,
      claim: { select: { employeeId: true, status: true, approvalChain: true, level1ById: true, level2ById: true, level3ById: true } },
    },
  });
  if (!att) return { success: false as const, error: "Attachment not found." };
  const access = await canReadClaim(u, att.claim);
  if (!access.ok) return { success: false as const, error: "Insufficient permissions" };
  // Same contract as before (a data-URL): an object-storage ref is fetched and
  // re-encoded here so the viewer never has to know where the bytes live.
  return { success: true as const, data: { fileName: att.fileName, mimeType: att.mimeType, data: await readFileValueAsDataUrl(att.data) } };
}

/** The legacy single bill (claims raised before multi-attachments), same access rule. */
export async function getClaimLegacyBill(claimId: string) {
  const u = await requireUser();
  if (!u?.id) return { success: false as const, error: "Not signed in." };
  const claim = await prisma.hrReimbursementClaim.findUnique({
    where: { id: claimId },
    select: { employeeId: true, status: true, billUrl: true, approvalChain: true, level1ById: true, level2ById: true, level3ById: true },
  });
  if (!claim?.billUrl) return { success: false as const, error: "No bill on this claim." };
  const access = await canReadClaim(u, claim);
  if (!access.ok) return { success: false as const, error: "Insufficient permissions" };
  return { success: true as const, data: { data: await readFileValueAsDataUrl(claim.billUrl) } };
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

  // Every file passed checkAttachments. With object storage enabled the bytes
  // go to the bucket and `data` holds the ref; otherwise the data-URL is
  // stored inline exactly as before.
  const stored: string[] = [];
  for (const f of files) {
    stored.push(
      await storeIncomingFile(f.data, { prefix: "hr/claims", ownerType: "HrClaimAttachment", ownerId: claimId, createdById: u.id })
    );
  }

  await prisma.hrClaimAttachment.createMany({
    data: files.map((f, i) => ({
      claimId,
      fileName: f.fileName.slice(0, 180),
      mimeType: f.mimeType,
      sizeBytes: check.sizes[i] ?? 0,
      data: stored[i] ?? f.data,
      uploadedById: u.id,
    })),
  });

  // Evidence changed: bump the claim's version so an approver's open screen
  // (showing the old bills) can't approve it without refreshing.
  await prisma.hrReimbursementClaim.update({ where: { id: claimId }, data: { updatedAt: new Date() } });
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
  await prisma.hrReimbursementClaim.update({ where: { id: att.claimId }, data: { updatedAt: new Date() } });
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
    select: { employeeId: true, status: true, title: true, amount: true, category: true, claimDate: true },
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
  // The route is worked out again too, so it reflects the reporting line today.
  const chain = await resolveClaimChain(me.id, claim.category);
  data.status = "PENDING";
  data.stageIndex = 0;
  data.approvalChain = chain as unknown as Prisma.InputJsonValue;
  data.decisionNote = null;
  data.level1ById = null; data.level1At = null; data.level1Note = null;
  data.level2ById = null; data.level2At = null; data.level2Note = null;
  data.level3ById = null; data.level3At = null; data.level3Note = null;

  // A changed fuel amount must still fit the monthly cap; this claim's own old
  // amount is left out of the running total.
  try {
    await prisma.$transaction(async (tx) => {
      if (claim.category === "FUEL" && data.amount !== undefined) {
        const capRow = await tx.employee.findUnique({ where: { id: me.id }, select: { fuelMonthlyCap: true } });
        const cap = capRow?.fuelMonthlyCap != null ? Number(capRow.fuelMonthlyCap) : null;
        if (cap != null) {
          await lockFuelCap(tx, me.id);
          const check = checkFuelCap({
            cap,
            alreadyClaimed: await fuelClaimedInMonth(tx, me.id, claim.claimDate, claimId),
            amount: Number(data.amount),
          });
          if (!check.ok) throw new FuelCapError(check.message);
        }
      }
      await tx.hrReimbursementClaim.update({ where: { id: claimId }, data });
    });
  } catch (e) {
    if (e instanceof FuelCapError) return { success: false, error: e.message };
    throw e;
  }
  await recordClaimEvent(claimId, "RESUBMITTED", {
    from: claim.status, to: "PENDING", actorId: u.id, actorName: u.name ?? null,
    note: "Employee updated the claim and sent it back for approval",
  });

  const first = chain[0];
  await notifyOwner(me.id, claimId, "Reimbursement claim resubmitted",
    `Your claim "${(data.title as string) ?? claim.title}" was sent back for approval. Route: ${chainSummary(chain)}. Status: Pending — ${first.label} with ${stageHolder(first)}.`);
  await notifyClaimStep(await usersByIds(first.approverIds), {
    title: "Reimbursement claim resubmitted",
    body: `${describeClaim({ title: (data.title as string) ?? claim.title, amount: Number(data.amount ?? claim.amount), employeeName: `${me.firstName} ${me.lastName}`.trim() })} was updated and needs your ${first.label.toLowerCase()} again.`,
    actionUrl: "/me/approvals",
    claimId,
  });

  revalidateAll();
  return { success: true, data: { id: claimId } };
}
