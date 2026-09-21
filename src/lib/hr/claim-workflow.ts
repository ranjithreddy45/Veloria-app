// ============================================================
// Reimbursement approval workflow — the rules in one place.
// ------------------------------------------------------------
// Flow: employee submits → LEVEL 1 (first-level validation, one approver for
// the whole company) → LEVEL 2 (second-level, resolved from the employee's
// department; optional "ALL" fallback) → APPROVED (visible to Finance, who
// schedules it on a pay run or records a direct payment) → PAID.
// Finance never sees a claim before both approvals are complete.
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
 * Who must approve a claim from this employee. Department-specific level-2
 * rules win over the "ALL" fallback. With no level-1 rule configured, the
 * active SUPER_ADMINs stand in so a claim can never be orphaned.
 */
export async function resolveClaimApprovers(
  employee: { departmentId: string | null },
  category?: string
): Promise<ResolvedApprovers> {
  const rules = await prisma.hrReimbursementApprover.findMany();
  
  let l1Rule = rules.find((r) => r.level === 1 && r.scope === "ALL");
  if (category === "EVENT") {
    const eventL1 = rules.find((r) => r.level === 1 && r.scope === "CATEGORY_EVENT");
    if (eventL1) l1Rule = eventL1;
  }
  
  const l2Rule =
    (employee.departmentId && rules.find((r) => r.level === 2 && r.scope === employee.departmentId)) ||
    rules.find((r) => r.level === 2 && r.scope === "ALL") ||
    null;

  const ids = [l1Rule?.userId, l2Rule?.userId].filter(Boolean) as string[];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: userSelect })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  let level1 = l1Rule && byId.get(l1Rule.userId) ? [byId.get(l1Rule.userId)!] : [];
  if (level1.length === 0) {
    level1 = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: userSelect,
    });
  }
  const level2 = l2Rule && byId.get(l2Rule.userId) ? [byId.get(l2Rule.userId)!] : [];
  const level3 = await financeRecipients();

  return { level1, level2, level3, level1Configured: !!l1Rule, level2Configured: !!l2Rule };
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
