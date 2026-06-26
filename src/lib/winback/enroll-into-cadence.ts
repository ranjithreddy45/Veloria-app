// ============================================================
// Unauthed cadence-enrollment helper — cloned from
// autoEnrollLeadIntoCadences (lead-pipeline.ts). Creates a CadenceEnrollment
// directly via prisma so cron handlers (which have no session) can enroll a
// subject into a win-back cadence. cadence.actions.ts enrollEntity/bulkEnroll
// are session-gated and cannot be called from a cron.
//
// Plain library (NOT "use server"): import-only by the win-back engine and
// the cooling-lead sweep. Exporting an enroll fn from a "use server" file
// would create an unauthenticated server-action enrollment surface — never do
// that.
// ============================================================

import { prisma } from "@/lib/prisma";

/** First active SUPER_ADMIN/ADMIN — the system actor for automated rows. */
export async function getSystemUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
    select: { id: true },
  });
  return admin?.id || "";
}

export interface EnrollResult {
  enrollmentId: string | null;
  alreadyEnrolled: boolean;
}

/**
 * Enroll an entity (lead or contact) into a specific cadence, idempotently.
 * Guarded by the CadenceEnrollment @@unique(cadenceId, entityId): a subject
 * already enrolled is left untouched (alreadyEnrolled=true, no new row).
 *
 * nextExecuteAt is computed from the cadence's first step delay, mirroring
 * autoEnrollLeadIntoCadences exactly. enrolledById is the system user.
 *
 * Best-effort: never throws — returns {enrollmentId: null} on failure.
 */
export async function enrollEntityIntoCadence(
  cadenceId: string,
  entityId: string,
  _entityType: "LEAD" | "CONTACT" = "LEAD",
  firstStepDelayMs: number | null = 0
): Promise<EnrollResult> {
  try {
    const existing = await prisma.cadenceEnrollment.findUnique({
      where: { cadenceId_entityId: { cadenceId, entityId } },
      select: { id: true },
    });
    if (existing) {
      return { enrollmentId: existing.id, alreadyEnrolled: true };
    }

    const systemId = await getSystemUserId();
    const nextExecuteAt =
      firstStepDelayMs == null ? null : new Date(Date.now() + firstStepDelayMs);

    const enrollment = await prisma.cadenceEnrollment.create({
      data: {
        cadenceId,
        entityId,
        enrolledById: systemId,
        status: "ACTIVE",
        currentStepOrder: 0,
        nextExecuteAt,
      },
      select: { id: true },
    });
    return { enrollmentId: enrollment.id, alreadyEnrolled: false };
  } catch (e) {
    // A concurrent run could win the unique race between findUnique + create.
    // Re-read once so we still return the (other run's) enrollment id.
    try {
      const racedWinner = await prisma.cadenceEnrollment.findUnique({
        where: { cadenceId_entityId: { cadenceId, entityId } },
        select: { id: true },
      });
      if (racedWinner) {
        return { enrollmentId: racedWinner.id, alreadyEnrolled: true };
      }
    } catch {
      /* ignore */
    }
    console.error("[enrollEntityIntoCadence] error:", e);
    return { enrollmentId: null, alreadyEnrolled: false };
  }
}
