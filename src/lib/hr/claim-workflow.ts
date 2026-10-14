// ============================================================
// Reimbursement approval workflow — the rules in one place.
// ------------------------------------------------------------
// Flow: employee submits → the claim's approval CHAIN, one stage at a time
// (see ./claim-chain.ts for how the chain is chosen) → APPROVED (Finance
// schedules it on a pay run or records a direct payment) → PAID. The chain is
// snapshotted on the claim when it is submitted. Claims raised before chains
// existed get one the first time they are touched (ensureClaimChain).
//
// Plain lib (not "use server") so labels/helpers can be shared with client
// components; the DB-touching helpers are only ever called from actions.
// ============================================================

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import {
  buildChain,
  chainSummary,
  eligibleStage,
  parseChain,
  parseRouteStages,
  pickRoute,
  stageForStatus,
  stageHolder,
  statusForStage,
  type ChainStage,
  type RouteKind,
  type StageSpec,
} from "./claim-chain";

export {
  CLAIM_STATUS_LABEL,
  CLAIM_STATUS_HUE,
  CLAIM_EVENT_LABEL,
  AWAITING_STATUSES,
  EDITABLE_BY_EMPLOYEE,
  awaitingLevel,
} from "./claim-labels";
import { AWAITING_STATUSES } from "./claim-labels";
import { pickApproverRules } from "./claim-routing";

export type ApproverUser = { id: string; name: string | null; email: string };

export interface ResolvedApprovers {
  /** First-level approver(s). Falls back to active SUPER_ADMINs when unset. */
  level1: ApproverUser[];
  /** Second-level approver for this employee's department, or [] when none. */
  level2: ApproverUser[];
  /** Third-level approver for Finance. */
  level3: ApproverUser[];
  level1Configured: boolean;
  /** True when level1 is the configured (active) approver, not the Super Admin stand-in. */
  level1FromRule: boolean;
  level2Configured: boolean;
}

const userSelect = { id: true, name: true, email: true } as const;

/**
 * Who must approve a claim from this employee. A per-employee route (scope
 * "EMP:<id>") wins at its level; otherwise the event pool (level 1, EVENT
 * claims), the department rule (level 2) and the "ALL" defaults apply. With no
 * level-1 rule the active SUPER_ADMINs stand in, so a claim is never orphaned;
 * with no per-employee final approver, Finance makes the final approval.
 */
export async function resolveClaimApprovers(
  employee: { id?: string | null; departmentId: string | null },
  category?: string
): Promise<ResolvedApprovers> {
  const rules = await prisma.hrReimbursementApprover.findMany({ select: { level: true, scope: true, userId: true } });
  const picked = pickApproverRules(rules, employee, category);

  const ids = [picked.l1?.userId, picked.l2?.userId, picked.l3?.userId].filter(Boolean) as string[];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: userSelect })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  let level1 = picked.l1 && byId.get(picked.l1.userId) ? [byId.get(picked.l1.userId)!] : [];
  const level1FromRule = level1.length > 0;
  if (level1.length === 0) {
    level1 = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: userSelect,
    });
  }
  const level2 = picked.l2 && byId.get(picked.l2.userId) ? [byId.get(picked.l2.userId)!] : [];
  const level3 =
    picked.l3 && byId.get(picked.l3.userId) ? [byId.get(picked.l3.userId)!] : await financeRecipients();

  return { level1, level2, level3, level1Configured: !!picked.l1, level1FromRule, level2Configured: !!picked.l2 };
}

/** The users Finance-side notifications go to: FINANCE role, else hr:payroll holders. */
export async function financeRecipients(): Promise<ApproverUser[]> {
  const finance = await prisma.user.findMany({
    where: { role: "FINANCE", isActive: true },
    select: userSelect,
  });
  if (finance.length > 0) return finance;
  return prisma.user.findMany({
    where: { role: { in: ["HR_MANAGER", "ADMIN"] }, isActive: true },
    select: userSelect,
  });
}

/**
 * The approval chain for a claim from this employee, right now: their own
 * route, else their reporting manager's team route, else the default rules
 * (1st approver → 2nd approver if configured → Finance). Self-approval rule
 * applied (claim-chain.ts buildChain).
 */
export async function resolveClaimChain(employeeId: string, category?: string | null): Promise<ChainStage[]> {
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true, departmentId: true, userId: true, reportingManagerId: true,
      reportingManager: { select: { userId: true } },
    },
  });
  const superAdmins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: userSelect });
  const ctx = { claimantUserId: emp?.userId ?? null, superAdmins };

  const subjects = [emp?.id, emp?.reportingManagerId].filter(Boolean) as string[];
  const rows = subjects.length
    ? await prisma.hrReimbursementRoute.findMany({
        where: { subjectEmployeeId: { in: subjects } },
        select: { kind: true, subjectEmployeeId: true, stages: true },
      })
    : [];
  const route = emp
    ? pickRoute(
        rows.map((r) => ({ kind: r.kind as RouteKind, subjectEmployeeId: r.subjectEmployeeId, stages: parseRouteStages(r.stages) })),
        { id: emp.id, reportingManagerId: emp.reportingManagerId },
      )
    : null;

  if (route) {
    const managerUserId = emp?.reportingManager?.userId ?? null;
    const ids = [
      ...route.stages.flatMap((st) => (st.type === "USER" ? [st.userId] : [])),
      ...(managerUserId ? [managerUserId] : []),
    ];
    const users = ids.length
      ? await prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: userSelect })
      : [];
    const byId = new Map(users.map((x) => [x.id, x]));
    const finance = route.stages.some((st) => st.type === "FINANCE") ? await financeRecipients() : [];
    const specs: StageSpec[] = route.stages.map((st) => {
      if (st.type === "MANAGER") {
        const m = managerUserId ? byId.get(managerUserId) : undefined;
        return { type: "MANAGER", role: "Reporting manager", candidates: m ? [m] : [] };
      }
      if (st.type === "FINANCE") return { type: "FINANCE", role: "Finance", candidates: finance };
      const named = byId.get(st.userId);
      return { type: "USER", role: named ? named.name ?? named.email : "Named approver (inactive)", candidates: named ? [named] : [] };
    });
    return buildChain(specs, ctx);
  }

  // id: null — the old per-employee level rules ("EMP:<id>") are superseded by
  // routes, so the default chain must not pick them up.
  const a = await resolveClaimApprovers({ id: null, departmentId: emp?.departmentId ?? null }, category ?? undefined);
  // An unconfigured (or inactive) 1st approver resolves to every Super Admin;
  // pass none instead so buildChain's fallback leaves out the claimant AND the
  // later stages' approvers, rather than listing them twice.
  const specs: StageSpec[] = [{ type: "DEFAULT", role: "1st approver", candidates: a.level1FromRule ? a.level1 : [] }];
  if (a.level2.length) specs.push({ type: "DEFAULT", role: "2nd approver", candidates: a.level2 });
  specs.push({ type: "FINANCE", role: "Finance", candidates: a.level3 });
  return buildChain(specs, ctx);
}

export interface ClaimChainState {
  chain: ChainStage[];
  /** Stage awaiting a decision, or null when the claim is not awaiting one. */
  stageIndex: number | null;
  /** The status the claim now carries (attaching a chain can renumber it). */
  status: string;
  /** The row's updatedAt after any attach — the version a decision must match. */
  updatedAt: Date | null;
}

type ChainClaim = {
  id: string; employeeId: string; status: string; category: string; title: string;
  amount: Prisma.Decimal | number; approvalChain: Prisma.JsonValue | null; stageIndex: number | null;
  updatedAt?: Date | null;
  level1ById?: string | null; level1At?: Date | null; level1Note?: string | null;
  level2ById?: string | null; level2At?: Date | null; level2Note?: string | null;
};

/**
 * The claim's chain. A claim raised before chains existed gets one now. It
 * starts at the 1st stage; an approval it already has under the old rules is
 * carried over only when that approver also holds the same stage of the new
 * chain — so no stage is ever passed without a recorded decision. The
 * approvers of the stage it lands on and the employee are told where it is.
 * Claimed with a guarded update, so two requests attaching at once notify
 * only once.
 */
export async function ensureClaimChain(claim: ChainClaim): Promise<ClaimChainState> {
  const awaiting = stageForStatus(claim.status);
  const stored = parseChain(claim.approvalChain);
  if (stored) {
    return {
      chain: stored,
      stageIndex: awaiting == null ? null : claim.stageIndex ?? awaiting,
      status: claim.status,
      updatedAt: claim.updatedAt ?? null,
    };
  }
  if (awaiting == null) return { chain: [], stageIndex: null, status: claim.status, updatedAt: claim.updatedAt ?? null };

  const chain = await resolveClaimChain(claim.employeeId, claim.category);
  const legacy = [
    { by: claim.level1ById ?? null, at: claim.level1At ?? null, note: claim.level1Note ?? null },
    { by: claim.level2ById ?? null, at: claim.level2At ?? null, note: claim.level2Note ?? null },
  ];
  const legacyNames = await usersByIds(legacy.flatMap((l) => (l.by ? [l.by] : [])));
  let stageIndex = 0;
  for (let i = 0; i < Math.min(awaiting, chain.length - 1, legacy.length); i++) {
    const l = legacy[i];
    if (!l.by || !l.at || !chain[i].approverIds.includes(l.by)) break;
    const who = legacyNames.find((x) => x.id === l.by);
    chain[i] = { ...chain[i], decidedById: l.by, decidedByName: who ? who.name ?? who.email : null, decidedAt: l.at.toISOString(), note: l.note };
    stageIndex = i + 1;
  }
  const status = statusForStage(stageIndex);
  const won = await prisma.hrReimbursementClaim.updateMany({
    where: { id: claim.id, status: claim.status, stageIndex: null },
    data: { approvalChain: chain as unknown as Prisma.InputJsonValue, stageIndex, status },
  });
  const fresh = await prisma.hrReimbursementClaim.findUnique({
    where: { id: claim.id },
    select: { status: true, approvalChain: true, stageIndex: true, updatedAt: true },
  });
  if (won.count === 0) {
    const c = parseChain(fresh?.approvalChain ?? null) ?? [];
    const idx = fresh ? stageForStatus(fresh.status) : null;
    return {
      chain: c,
      stageIndex: idx == null ? null : fresh?.stageIndex ?? idx,
      status: fresh?.status ?? claim.status,
      updatedAt: fresh?.updatedAt ?? null,
    };
  }

  const carried = stageIndex > 0 ? ` Earlier approval${stageIndex === 1 ? "" : "s"} carried over: ${stageIndex}.` : "";
  try {
    await prisma.hrClaimEvent.create({
      data: {
        claimId: claim.id, action: "ROUTED", fromStatus: claim.status, toStatus: status,
        note: `Moved to the approval route ${chainSummary(chain)}; now at ${chain[stageIndex].label.toLowerCase()}.${carried}`,
      },
    });
  } catch (e) {
    console.error("[CLAIM_EVENT] ROUTED", claim.id, e);
  }
  const emp = await prisma.employee.findUnique({
    where: { id: claim.employeeId },
    select: { firstName: true, lastName: true, userId: true },
  });
  const employeeName = `${emp?.firstName ?? ""} ${emp?.lastName ?? ""}`.trim() || "An employee";
  const stage = eligibleStage(chain, stageIndex)!;
  await notifyClaimStep(await usersByIds(stage.approverIds), {
    title: "Reimbursement claim awaiting your approval",
    body: `${describeClaim({ title: claim.title, amount: Number(claim.amount), employeeName })} needs your ${stage.label.toLowerCase()}.`,
    actionUrl: "/me/approvals",
    claimId: claim.id,
  });
  const owner = emp?.userId ? await usersByIds([emp.userId]) : [];
  await notifyClaimStep(owner, {
    title: "Your claim's approval route was updated",
    body: `Your claim "${claim.title}" now goes ${chainSummary(chain)}. Status: Pending — ${stage.label} with ${stageHolder(stage)}.`,
    actionUrl: "/me/reimbursements",
    claimId: claim.id,
  });
  return { chain, stageIndex, status, updatedAt: fresh?.updatedAt ?? null };
}

/** Backstop (frequent cron): give every in-flight claim without a chain one. */
export async function attachMissingClaimChains(): Promise<{ attached: number }> {
  const rows = await prisma.hrReimbursementClaim.findMany({
    where: { status: { in: [...AWAITING_STATUSES] }, stageIndex: null },
    select: {
      id: true, employeeId: true, status: true, category: true, title: true, amount: true, approvalChain: true, stageIndex: true,
      updatedAt: true, level1ById: true, level1At: true, level1Note: true, level2ById: true, level2At: true, level2Note: true,
    },
    take: 200,
  });
  let attached = 0;
  for (const r of rows) {
    if (parseChain(r.approvalChain)) continue;
    await ensureClaimChain(r);
    attached++;
  }
  return { attached };
}

export async function usersByIds(ids: string[]): Promise<ApproverUser[]> {
  if (ids.length === 0) return [];
  return prisma.user.findMany({ where: { id: { in: ids } }, select: userSelect });
}

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

/**
 * In-app + email to each recipient. Awaited so a serverless function can't
 * freeze before the writes land; failures are logged, never thrown — a
 * notification must not be the reason an approval fails.
 */
export async function notifyClaimStep(
  recipients: ApproverUser[],
  msg: { title: string; body: string; actionUrl: string; claimId: string }
): Promise<void> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com").replace(/\/$/, "");
  await Promise.all(
    recipients.map(async (r) => {
      await notifyAwait({
        userId: r.id,
        type: "SYSTEM",
        title: msg.title,
        message: msg.body,
        actionUrl: msg.actionUrl,
        metadata: { claimId: msg.claimId },
      });
      if (!r.email) return;
      try {
        await sendEmail({
          to: r.email,
          subject: msg.title,
          html: `<p>Hi ${r.name ?? ""},</p><p>${msg.body}</p><p><a href="${appUrl}${msg.actionUrl}">Open in Veloria Grand</a></p>`,
        });
      } catch (e) {
        console.error("[CLAIM_EMAIL]", e);
      }
    })
  );
}

export function describeClaim(c: { title: string; amount: number | string; employeeName: string }) {
  return `${c.employeeName} — ${c.title} (${inr(Number(c.amount))})`;
}

/**
 * A payroll run was marked paid: every approved claim it carries becomes PAID
 * now — not when the run was computed, which is before any money moves. Each
 * gets a PAID event and the employee is told. Idempotent: a claim is logged
 * and notified only by the call that actually flipped it, so a retry (or the
 * cron backstop) after a partial failure finishes the job without repeats.
 */
export async function settleRunReimbursements(runId: string, actor: { id: string | null; name: string | null }): Promise<number> {
  const run = await prisma.hrPayrollRun.findUnique({ where: { id: runId }, select: { fy: true, month: true } });
  const claims = await prisma.hrReimbursementClaim.findMany({
    where: { runId, status: "APPROVED" },
    select: { id: true, employeeId: true, title: true },
  });
  if (claims.length === 0 || !run) return 0;
  const payroll = `${run.month}/${run.fy}`;
  const emps = await prisma.employee.findMany({
    where: { id: { in: Array.from(new Set(claims.map((c) => c.employeeId))) } },
    select: { id: true, userId: true },
  });
  const owners = await usersByIds(emps.flatMap((e) => (e.userId ? [e.userId] : [])));
  let settled = 0;
  for (const c of claims) {
    const flipped = await prisma.hrReimbursementClaim.updateMany({
      where: { id: c.id, status: "APPROVED", runId },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (flipped.count === 0) continue;
    settled++;
    try {
      await prisma.hrClaimEvent.create({
        data: {
          claimId: c.id, action: "PAID", fromStatus: "APPROVED", toStatus: "PAID",
          actorId: actor.id, actorName: actor.name, note: `Paid with the ${payroll} payroll`,
        },
      });
    } catch (e) {
      console.error("[CLAIM_EVENT] PAID (payroll)", c.id, e);
    }
    const userId = emps.find((e) => e.id === c.employeeId)?.userId;
    const owner = owners.find((o) => o.id === userId);
    if (owner) {
      await notifyClaimStep([owner], {
        title: "Reimbursement paid",
        body: `Your claim "${c.title}" was paid with the ${payroll} payroll. Status: Paid — this claim is complete.`,
        actionUrl: "/me/reimbursements",
        claimId: c.id,
      });
    }
  }
  return settled;
}

/**
 * Claims an earlier version of computePayrollRun stamped PAID at compute time
 * (runId set, no paymentRef — a hand payment never sets runId) on a run not yet
 * paid go back to APPROVED, so they are paid, logged and notified with the run.
 */
export async function normaliseOldComputePaid(runIds?: string[]): Promise<void> {
  if (runIds && runIds.length === 0) return;
  const unpaid = await prisma.hrPayrollRun.findMany({
    where: { ...(runIds ? { id: { in: runIds } } : {}), status: { in: ["DRAFT", "LOCKED"] } },
    select: { id: true },
  });
  if (unpaid.length === 0) return;
  await prisma.hrReimbursementClaim.updateMany({
    where: { runId: { in: unpaid.map((r) => r.id) }, status: "PAID", paymentRef: null },
    data: { status: "APPROVED", paidAt: null },
  });
}

/**
 * A run was locked. Claims scheduled on its month that are not on its payslips
 * (the employee had no salary structure, or the run was not recomputed after
 * scheduling) would never be paid by it: un-schedule them, log why, and tell
 * Finance so they can pick a later month or pay directly.
 */
export async function releaseUnpaidRunClaims(runId: string, actor: { id: string | null; name: string | null }): Promise<number> {
  await normaliseOldComputePaid([runId]);
  const run = await prisma.hrPayrollRun.findUnique({ where: { id: runId }, select: { fy: true, month: true, entityId: true } });
  if (!run) return 0;
  const candidates = await prisma.hrReimbursementClaim.findMany({
    where: { entityId: run.entityId, status: "APPROVED", runId: null, payFy: run.fy, payMonth: run.month },
    select: { id: true },
  });
  // Each claim released with its own guarded update; only the ones this call
  // actually changed are logged and counted (a concurrent reschedule, payment,
  // compute tag or second lock leaves the row alone).
  const stranded: string[] = [];
  for (const c of candidates) {
    const r = await prisma.hrReimbursementClaim.updateMany({
      where: { id: c.id, status: "APPROVED", runId: null, payFy: run.fy, payMonth: run.month },
      data: { payFy: null, payMonth: null },
    });
    if (r.count === 1) stranded.push(c.id);
  }
  if (stranded.length === 0) return 0;
  try {
    await prisma.hrClaimEvent.createMany({
      data: stranded.map((id) => ({
        claimId: id, action: "PAY_RUN_UNSCHEDULED", fromStatus: "APPROVED", toStatus: "APPROVED", actorId: actor.id, actorName: actor.name,
        note: `Not on the ${run.month}/${run.fy} payroll when it was locked — needs a later pay run or a direct payment`,
      })),
    });
  } catch (e) {
    console.error("[CLAIM_EVENT] unscheduled at lock", runId, e);
  }
  await notifyClaimStep(await financeRecipients(), {
    title: "Reimbursements need rescheduling",
    body: `${stranded.length} approved claim${stranded.length === 1 ? " was" : "s were"} scheduled on the ${run.month}/${run.fy} payroll but not on its payslips when it was locked. Pick a later month or record a direct payment.`,
    actionUrl: "/finance/reimbursements",
    claimId: stranded[0],
  });
  return stranded.length;
}

/**
 * Backstop (frequent cron) for frozen runs: claims scheduled on a LOCKED or
 * PAID run's month but not on it (a schedule racing the lock, a failed release
 * at lock, runs frozen before this code) are un-scheduled and Finance told.
 */
export async function releaseFrozenRunClaims(): Promise<{ released: number }> {
  const frozen = await prisma.hrPayrollRun.findMany({ where: { status: { in: ["LOCKED", "PAID"] } }, select: { id: true, fy: true, month: true, entityId: true } });
  let released = 0;
  for (const run of frozen) {
    const any = await prisma.hrReimbursementClaim.count({
      where: { entityId: run.entityId, status: "APPROVED", runId: null, payFy: run.fy, payMonth: run.month },
    });
    if (any > 0) released += await releaseUnpaidRunClaims(run.id, { id: null, name: "System" });
  }
  return { released };
}

/** Backstop (frequent cron): settle approved claims whose payroll run is already PAID. */
export async function settlePaidRunClaims(): Promise<{ settled: number }> {
  const tagged = await prisma.hrReimbursementClaim.findMany({
    where: { status: "APPROVED", runId: { not: null } },
    select: { runId: true },
    distinct: ["runId"],
  });
  const runIds = tagged.flatMap((t) => (t.runId ? [t.runId] : []));
  if (runIds.length === 0) return { settled: 0 };
  const paidRuns = await prisma.hrPayrollRun.findMany({ where: { id: { in: runIds }, status: "PAID" }, select: { id: true } });
  let settled = 0;
  for (const r of paidRuns) settled += await settleRunReimbursements(r.id, { id: null, name: "System" });
  return { settled };
}
