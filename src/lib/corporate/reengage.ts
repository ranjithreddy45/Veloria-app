// ============================================================
// Corporate re-engage enqueue — quarterly re-engagement sweep.
//
// Finds CorporateAccounts whose nextReengageAt is due (<= now) and that are
// not CHURNED, then for each:
//   1. one-shot upserts a WinbackTarget(kind=CORPORATE_FARMING) keyed on
//      contactId (idempotent guard so a same-cycle rerun doesn't double-enroll),
//   2. enrolls the account's Contact into the configured re-engage Cadence
//      (entityType=CONTACT) via the unauthed enrollEntityIntoCadence helper,
//   3. stamps reengageCadenceId / enrollmentId on the account,
//   4. advances nextReengageAt by a quarter so re-enrollment is one-per-cycle.
//
// Plain library (NOT "use server", no auth): callable from the cron route with
// no session, mirroring catchCoolingLeads. Best-effort — never throws.
//
// Degrades gracefully: if no ACTIVE entityType=CONTACT re-engage Cadence
// exists, it no-ops (noCadence:true) and advances nothing, so accounts are
// never permanently marked-handled before a cadence is wired.
// ============================================================

import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { enrollEntityIntoCadence } from "@/lib/winback/enroll-into-cadence";
import { WINBACK_CADENCE_NAMES } from "@/lib/winback/winback-config";

const DAY_MS = 24 * 60 * 60 * 1000;
const QUARTER_MS = 90 * DAY_MS;
const BATCH = 200;

export interface ReengageResult {
  scanned: number;
  enrolled: number;
  skipped: number;
  noCadence: boolean;
}

interface ResolvedCadence {
  id: string;
  firstStepDelayMs: number | null;
}

/**
 * Resolve the ACTIVE, entityType=CONTACT corporate re-engage Cadence by its
 * stable name (shared with the win-back config taxonomy). Returns null when
 * none is configured. CONTACT-entity cadences are supported by the executor's
 * resolveContactId path.
 */
async function resolveReengageCadence(): Promise<ResolvedCadence | null> {
  const name = WINBACK_CADENCE_NAMES.CORPORATE_FARMING;
  try {
    const cadence = await prisma.cadence.findFirst({
      where: { name, status: "ACTIVE", entityType: "CONTACT" },
      include: { steps: { orderBy: { order: "asc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
    if (!cadence) return null;
    const firstStep = cadence.steps[0];
    const firstStepDelayMs = firstStep
      ? (firstStep.delayDays ?? 0) * DAY_MS + (firstStep.delayHours ?? 0) * 60 * 60 * 1000
      : null;
    return { id: cadence.id, firstStepDelayMs };
  } catch (e) {
    console.error("[resolveReengageCadence] error:", e);
    return null;
  }
}

/**
 * Run one quarterly re-engage enqueue sweep. Returns counts; never throws.
 */
export async function enqueueCorporateReengage(): Promise<ReengageResult> {
  const result: ReengageResult = { scanned: 0, enrolled: 0, skipped: 0, noCadence: false };
  const now = new Date();

  try {
    const cadence = await resolveReengageCadence();
    if (!cadence) {
      result.noCadence = true;
      return result;
    }

    const due = await prisma.corporateAccount.findMany({
      where: {
        tier: { not: "CHURNED" },
        nextReengageAt: { not: null, lte: now },
      },
      select: {
        id: true,
        contactId: true,
        accountName: true,
        tier: true,
        ownerUserId: true,
        lastEventDate: true,
      },
      orderBy: { nextReengageAt: "asc" },
      take: BATCH,
    });
    result.scanned = due.length;
    if (due.length === 0) return result;

    for (const acct of due) {
      try {
        // (1) Idempotent WinbackTarget find-or-create on (kind, contactId).
        const existingTarget = await prisma.winbackTarget.findFirst({
          where: { kind: "CORPORATE_FARMING", contactId: acct.contactId },
          select: { id: true, status: true, lastAttemptAt: true },
        });

        // One-shot per cycle: if a target already enrolled within this quarter,
        // skip (the nextReengageAt advance below is the primary guard).
        if (
          existingTarget &&
          existingTarget.status === "ENROLLED" &&
          existingTarget.lastAttemptAt &&
          now.getTime() - existingTarget.lastAttemptAt.getTime() < QUARTER_MS
        ) {
          result.skipped++;
          continue;
        }

        let targetId = existingTarget?.id ?? null;
        if (!targetId) {
          const created = await prisma.winbackTarget.create({
            data: {
              kind: "CORPORATE_FARMING",
              status: "PENDING",
              contactId: acct.contactId,
            },
            select: { id: true },
          });
          targetId = created.id;
        }

        // (2) Enroll the Contact (NOT the auth-gated enrollEntity action).
        // Guarded by CadenceEnrollment (cadenceId, entityId) unique — a contact
        // already enrolled is left untouched and treated as a successful enroll.
        const { enrollmentId } = await enrollEntityIntoCadence(
          cadence.id,
          acct.contactId,
          "CONTACT",
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

        // (3) Stamp account + transition target, and (4) advance the anchor so
        // the next sweep only re-enrolls a full quarter later.
        const nextReengageAt = new Date(now.getTime() + QUARTER_MS);
        await prisma.corporateAccount.update({
          where: { id: acct.id },
          data: {
            reengageCadenceId: cadence.id,
            nextReengageAt,
          },
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

        // Notify the account owner (await so serverless can't drop it).
        if (acct.ownerUserId) {
          await notifyAwait({
            userId: acct.ownerUserId,
            title: "🏢 Corporate account re-engaging",
            message: `"${acct.accountName}" (${acct.tier}) is due for quarterly re-engagement. Cadence started.`,
            type: "SYSTEM",
            actionUrl: `/accounts/${acct.id}`,
          });
        }

        // Audit (fire-and-forget).
        logActivity({
          userId: "system",
          action: "CORPORATE_REENGAGE_ENROLL",
          entityType: "corporate_account",
          entityId: acct.id,
          changes: { contactId: acct.contactId, cadenceId: cadence.id, tier: acct.tier },
        });

        result.enrolled++;
      } catch (e) {
        console.error("[enqueueCorporateReengage] account error:", acct.id, e);
        result.skipped++;
      }
    }
  } catch (e) {
    console.error("[enqueueCorporateReengage] error:", e);
  }

  return result;
}
