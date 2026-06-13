// ============================================================
// Velos triggers — maps live CRM events to award calls. Every
// function here is best-effort: it swallows its own errors so a
// points failure can NEVER break a sale, lead, task or payment.
// ============================================================

import { prisma } from "@/lib/prisma";
import { awardVelos, clawbackEntity } from "./award";
import { VELOS_TUNING } from "./config";

// Resilient pipeline-stage → Velos event mapping (matches on the stage name,
// which is admin-editable, so we normalise + substring-match rather than rely
// on exact strings).
export function pipelineEventForStage(stageName: string | null | undefined): string | null {
  if (!stageName) return null;
  const n = stageName.toLowerCase();
  if (n.includes("advance")) return "advance_received";
  if (n.includes("token")) return "token_paid";
  if (n.includes("contract") || n.includes("won") || n.includes("booked") || n.includes("confirm")) return "contract_signed";
  if (n.includes("execut") || n.includes("delivered") || n.includes("completed event") || n.includes("event done")) return "event_executed";
  if (n.includes("tentative") || n.includes("hold")) return "tentative_hold";
  if (n.includes("quote") || n.includes("proposal")) return "quote_sent";
  if (n.includes("visit") && (n.includes("done") || n.includes("complete"))) return "site_visit_done";
  if (n.includes("visit") || n.includes("viewing")) return "site_visit_scheduled";
  if (n.includes("contact")) return "contacted";
  return null;
}

// A5 quality gate, fed from /reviews: the cash-/quality-proximate award
// (event_executed) is withheld when the linked booking carries a poor review.
// No review yet → provisional pass (don't punish work that hasn't been rated).
export async function qualityGatePasses(dealId: string): Promise<boolean> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { dealId },
      select: { reviews: { select: { rating: true }, orderBy: { createdAt: "desc" }, take: 5 } },
    });
    if (!booking || booking.reviews.length === 0) return true; // not yet rated
    const avg = booking.reviews.reduce((s, r) => s + r.rating, 0) / booking.reviews.length;
    return avg >= 3; // out of 5
  } catch {
    return true; // never block an award on a gate-lookup failure
  }
}

// Called after a deal changes stage. Awards once per (deal, stage-event) and
// claws back sale-side points when the deal is lost/cancelled.
export async function velosOnDealStage(opts: {
  dealId: string; ownerId: string | null | undefined; stageName: string | null; isLostStage: boolean;
}): Promise<void> {
  try {
    if (opts.isLostStage) {
      await clawbackEntity(prisma, opts.dealId, "Deal lost / cancelled");
      return;
    }
    const ownerId = opts.ownerId;
    if (!ownerId) return;
    const eventType = pipelineEventForStage(opts.stageName);
    if (!eventType) return;
    // Quality gate on the closing award (A5).
    if (eventType === "event_executed" && !(await qualityGatePasses(opts.dealId))) return;
    const res = await awardVelos(prisma, { userId: ownerId, eventType, entityType: "deal", entityId: opts.dealId });

    // Assist credit (B6): on a fresh close, anyone who did the earlier site-visit
    // work on this deal — and isn't the closer — shares 25% of the close points.
    if (res.awarded && eventType === "contract_signed") {
      await awardAssistCredit(opts.dealId, ownerId, res.points);
    }
  } catch {
    /* never break the move */
  }
}

async function awardAssistCredit(dealId: string, closerId: string, closePoints: number): Promise<void> {
  const share = Math.round(closePoints * VELOS_TUNING.ASSIST_SHARE);
  if (share <= 0) return;
  const priors = await prisma.velosLedger.findMany({
    where: { entityId: dealId, eventType: { in: ["site_visit_done", "site_visit_scheduled"] } },
    select: { userId: true },
  });
  const assisters = [...new Set(priors.map((p) => p.userId))].filter((id) => id !== closerId);
  for (const assisterId of assisters) {
    await awardVelos(prisma, {
      userId: assisterId, eventType: "assist_credit", entityType: "assist", entityId: dealId,
      pointsOverride: share, keySuffix: assisterId, note: "Assist on close",
    });
  }
}

// Task completion → on-time award by priority.
export async function velosOnTaskDone(opts: {
  taskId: string; ownerId: string | null | undefined; priority: string | null | undefined; onTime: boolean;
}): Promise<void> {
  try {
    if (!opts.ownerId || !opts.onTime) return;
    const p = (opts.priority ?? "").toUpperCase();
    const eventType = p === "HIGH" || p === "URGENT" ? "task_done_on_time_high" : p === "LOW" ? "task_done_on_time_low" : "task_done_on_time_medium";
    await awardVelos(prisma, { userId: opts.ownerId, eventType, entityType: "task", entityId: opts.taskId });
  } catch {
    /* never break the task */
  }
}

// Payment collected on/before due → finance award.
export async function velosOnPaymentCollected(opts: {
  paymentId: string; ownerId: string | null | undefined; onOrBeforeDue: boolean;
}): Promise<void> {
  try {
    if (!opts.ownerId || !opts.onOrBeforeDue) return;
    await awardVelos(prisma, { userId: opts.ownerId, eventType: "payment_collected_on_or_before_due", entityType: "payment", entityId: opts.paymentId });
  } catch {
    /* never break the payment */
  }
}

// Lead contact logged → SLA speed engine (shipped WITH the quality gate above).
// before-SLA + within-15-min bonus stack; overdue penalty handled by the SLA cron.
export async function velosOnLeadContact(opts: {
  leadId: string; ownerId: string | null | undefined; withinSla: boolean; within15Min: boolean;
}): Promise<void> {
  try {
    if (!opts.ownerId) return;
    if (opts.withinSla) await awardVelos(prisma, { userId: opts.ownerId, eventType: "contact_logged_before_sla", entityType: "lead", entityId: opts.leadId });
    if (opts.within15Min) await awardVelos(prisma, { userId: opts.ownerId, eventType: "contact_logged_within_15min", entityType: "lead", entityId: opts.leadId });
  } catch {
    /* never break contact logging */
  }
}
