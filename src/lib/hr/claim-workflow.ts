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
  if (level1.length === 0) {
    level1 = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: userSelect,
    });
  }
  const level2 = picked.l2 && byId.get(picked.l2.userId) ? [byId.get(picked.l2.userId)!] : [];
  const level3 =
    picked.l3 && byId.get(picked.l3.userId) ? [byId.get(picked.l3.userId)!] : await financeRecipients();

  return { level1, level2, level3, level1Configured: !!picked.l1, level2Configured: !!picked.l2 };
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
  const specs: StageSpec[] = [{ type: "DEFAULT", role: a.level1Configured ? "1st approver" : "Super Admin", candidates: a.level1 }];
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
}

type ChainClaim = {
  id: string; employeeId: string; status: string; category: string; title: string;
  amount: Prisma.Decimal | number; approvalChain: Prisma.JsonValue | null; stageIndex: number | null;
};

/**
 * The claim's chain. A claim raised before chains existed gets one now, at
 * the stage its old status stood for, and the new stage's approvers and the
 * employee are told where it is. Claimed with a guarded update, so two
 * requests attaching at once notify only once.
 */
export async function ensureClaimChain(claim: ChainClaim): Promise<ClaimChainState> {
  const awaiting = stageForStatus(claim.status);
  const stored = parseChain(claim.approvalChain);
  if (stored) {
    return { chain: stored, stageIndex: awaiting == null ? null : claim.stageIndex ?? awaiting, status: claim.status };
  }
  if (awaiting == null) return { chain: [], stageIndex: null, status: claim.status };

  const chain = await resolveClaimChain(claim.employeeId, claim.category);
  const stageIndex = Math.min(awaiting, chain.length - 1);
  const status = statusForStage(stageIndex);
  const won = await prisma.hrReimbursementClaim.updateMany({
    where: { id: claim.id, status: claim.status, stageIndex: null },
    data: { approvalChain: chain as unknown as Prisma.InputJsonValue, stageIndex, status },
  });
  if (won.count === 0) {
    const fresh = await prisma.hrReimbursementClaim.findUnique({
      where: { id: claim.id },
      select: { status: true, approvalChain: true, stageIndex: true },
    });
    const c = parseChain(fresh?.approvalChain ?? null) ?? [];
    const idx = fresh ? stageForStatus(fresh.status) : null;
    return { chain: c, stageIndex: idx == null ? null : fresh?.stageIndex ?? idx, status: fresh?.status ?? claim.status };
  }

  try {
    await prisma.hrClaimEvent.create({
      data: {
        claimId: claim.id, action: "ROUTED", fromStatus: claim.status, toStatus: status,
        note: `Moved to the approval route ${chainSummary(chain)}; now at ${chain[stageIndex].label.toLowerCase()}.`,
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
  const stage = chain[stageIndex];
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
  return { chain, stageIndex, status };
}

/** Backstop (frequent cron): give every in-flight claim without a chain one. */
export async function attachMissingClaimChains(): Promise<{ attached: number }> {
  const rows = await prisma.hrReimbursementClaim.findMany({
    where: { status: { in: [...AWAITING_STATUSES] }, stageIndex: null },
    select: { id: true, employeeId: true, status: true, category: true, title: true, amount: true, approvalChain: true, stageIndex: true },
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
