// ============================================================
// Cooling-lead catch — auto re-warm sweep wired onto the score-decay cron.
// After the daily score-decay rescores Lead.score, this sweep finds OPEN,
// mid-funnel leads whose score has decayed below a threshold AND that have
// gone quiet (no recent inbound/outbound activity), then one-shot auto-enrolls
// each into the configured "Cooling Lead Re-warm" Cadence and stamps
// Lead.coolingEnrolledAt for dedupe. Each attempt is recorded as a
// WinbackTarget (kind=COOLING_LEAD) for idempotent reruns + reporting; the
// assigned rep is notified. Leads exit the re-warm flow via the existing
// cadence exit-criteria (REPLY_RECEIVED / STATUS_CHANGE).
//
// Plain library (NOT "use server"): callable from cron with no session
// (mirrors escalateLeadSlaBreaches). Never throws — best-effort per lead.
// ============================================================

import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { enrollEntityIntoCadence } from "@/lib/winback/enroll-into-cadence";
import {
  resolveWinbackCadence,
} from "@/lib/winback/winback-config";

// ------------------------------------------------------------
// Tuning thresholds (named exports so ops can adjust in code review).
// ------------------------------------------------------------
export const COOLING_SCORE_THRESHOLD = 30; // score strictly below this = cooling
export const COOLING_QUIET_DAYS = 5; // no activity / no update for this long
const BATCH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

// Mid-funnel, OPEN statuses. NEW is excluded (owned by speed-to-lead/SLA);
// WON/LOST are closed (LOST is handled by winback-crons revival, not here).
const COOLING_STATUSES = ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"] as const;

export interface CoolingCatchResult {
  scanned: number;
  enrolled: number;
  skipped: number;
  noCadence: boolean;
}

/**
 * Run one cooling-lead sweep. Returns counts; never throws.
 *
 * If no ACTIVE entityType=LEAD "Cooling Lead Re-warm" Cadence exists, returns
 * {noCadence:true} and stamps nothing — so leads are never permanently
 * marked-as-handled before a cadence is configured.
 */
export async function catchCoolingLeads(): Promise<CoolingCatchResult> {
  const result: CoolingCatchResult = { scanned: 0, enrolled: 0, skipped: 0, noCadence: false };
  const now = new Date();

  try {
    // (1) Resolve the cooling re-warm cadence — bail (no-op) when absent.
    const cadence = await resolveWinbackCadence("COOLING_LEAD");
    if (!cadence) {
      result.noCadence = true;
      return result;
    }

    // (2) Candidate cooled leads: open, mid-funnel, low score, stale, not yet
    // enrolled (coolingEnrolledAt one-shot flag), not soft-deleted.
    const quietBefore = new Date(now.getTime() - COOLING_QUIET_DAYS * DAY_MS);
    const candidates = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { in: [...COOLING_STATUSES] },
        coolingEnrolledAt: null,
        score: { lt: COOLING_SCORE_THRESHOLD },
        updatedAt: { lt: quietBefore },
      },
      select: {
        id: true,
        title: true,
        score: true,
        assignedToId: true,
        contactId: true,
      },
      orderBy: { updatedAt: "asc" },
      take: BATCH,
    });
    result.scanned = candidates.length;
    if (candidates.length === 0) return result;

    // (2b) Quiet detection — single batched groupBy over Communication by
    // contactId in the quiet window (avoids N+1). A contact with any comm in
    // the window is NOT quiet and is skipped.
    const contactIds = Array.from(
      new Set(candidates.map((l) => l.contactId).filter(Boolean))
    ) as string[];

    const recentComms = contactIds.length
      ? await prisma.communication.groupBy({
          by: ["contactId"],
          where: { contactId: { in: contactIds }, createdAt: { gte: quietBefore } },
          _count: { _all: true },
        })
      : [];
    const recentWa = contactIds.length
      ? await prisma.whatsAppMessage.groupBy({
          by: ["contactId"],
          where: { contactId: { in: contactIds }, sentAt: { gte: quietBefore } },
          _count: { _all: true },
        })
      : [];
    const noisyContacts = new Set<string>();
    for (const r of recentComms) if (r._count._all > 0) noisyContacts.add(r.contactId);
    for (const r of recentWa) if (r._count._all > 0) noisyContacts.add(r.contactId);

    for (const lead of candidates) {
      try {
        // Recent activity → not actually quiet; skip without marking.
        if (lead.contactId && noisyContacts.has(lead.contactId)) {
          result.skipped++;
          continue;
        }

        // (3) Idempotent WinbackTarget find-or-create on (kind, leadId).
        const existingTarget = await prisma.winbackTarget.findFirst({
          where: { kind: "COOLING_LEAD", leadId: lead.id },
          select: { id: true, status: true },
        });
        let targetId = existingTarget?.id ?? null;
        if (!targetId) {
          const created = await prisma.winbackTarget.create({
            data: {
              kind: "COOLING_LEAD",
              status: "PENDING",
              leadId: lead.id,
              contactId: lead.contactId,
            },
            select: { id: true },
          });
          targetId = created.id;
        } else if (existingTarget && existingTarget.status !== "PENDING") {
          // Already processed in a prior run — skip (coolingEnrolledAt also gates).
          result.skipped++;
          continue;
        }

        // Enroll directly (NOT the auth-gated enrollEntity action). Guarded by
        // the CadenceEnrollment (cadenceId, entityId) unique.
        const { enrollmentId } = await enrollEntityIntoCadence(
          cadence.id,
          lead.id,
          "LEAD",
          cadence.firstStepDelayMs
        );
        if (!enrollmentId) {
          await prisma.winbackTarget.update({
            where: { id: targetId },
            data: { attempts: { increment: 1 }, lastAttemptAt: now },
          });
          result.skipped++;
          continue;
        }

        // One-shot dedupe flag + WinbackTarget transition, in step.
        await prisma.lead.update({
          where: { id: lead.id },
          data: { coolingEnrolledAt: now },
        });
        await prisma.winbackTarget.update({
          where: { id: targetId },
          data: {
            status: "ENROLLED",
            cadenceId: cadence.id,
            enrollmentId,
            attempts: { increment: 1 },
            lastAttemptAt: now,
          },
        });

        // (4) Notify the assigned rep (await so serverless can't drop it).
        if (lead.assignedToId) {
          await notifyAwait({
            userId: lead.assignedToId,
            title: "🧊 Cooling lead re-warming",
            message: `"${lead.title}" went quiet (score ${lead.score}). Re-warm cadence started.`,
            type: "SYSTEM",
            actionUrl: `/leads/${lead.id}`,
          });
        }

        // (5) Audit (fire-and-forget).
        logActivity({
          userId: "system",
          action: "WINBACK_COOLING_ENROLL",
          entityType: "winback_target",
          entityId: targetId,
          changes: { leadId: lead.id, cadenceId: cadence.id, score: lead.score },
        });

        result.enrolled++;
      } catch (e) {
        console.error("[catchCoolingLeads] lead error:", lead.id, e);
        result.skipped++;
      }
    }
  } catch (e) {
    console.error("[catchCoolingLeads] error:", e);
  }
  return result;
}
