// ============================================================
// Reimbursement approval workflow — the rules in one place.
// ------------------------------------------------------------
// Flow: employee submits → 1st approval → 2nd approval (skipped when none is
// configured) → final approval (Finance, unless the employee has a named final
// approver) → APPROVED (Finance schedules it on a pay run or records a direct
// payment) → PAID. A per-employee route (see ./claim-routing.ts) can fix the
// whole chain for one person; everyone else follows the default rules.
//
// Plain lib (not "use server") so labels/helpers can be shared with client
// components; the DB-touching helpers are only ever called from actions.
// ============================================================

import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { sendEmail } from "@/lib/email";

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

/** Which level (1 or 2) a claim in an awaiting status is sitting at. */

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
