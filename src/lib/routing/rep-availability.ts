// ============================================================
// Rep availability — 1:1 RepAvailability upsert + lifecycle helpers
// ============================================================
// Plain library (NOT "use server"): shared by the rep-availability action,
// the SMART router, and the rep-availability cron. Centralizes the
// RepAvailability upsert (keyed on the @unique userId) so callers never
// duplicate the create/update dance. Every function is best-effort and
// self-contained; the router/cron paths must never be broken by these.

import { prisma } from "@/lib/prisma";
import type { RepAvailability, RepAvailabilityStatus } from "@prisma/client";

const DEFAULT_AUTO_OFFLINE_MIN = 15;

/**
 * Fetch the caller's RepAvailability row, creating an OFFLINE default row
 * on first touch. Idempotent via the userId @unique constraint.
 */
export async function getOrCreateRepAvailability(
  userId: string
): Promise<RepAvailability> {
  return prisma.repAvailability.upsert({
    where: { userId },
    create: { userId, status: "OFFLINE" },
    update: {},
  });
}

/**
 * Set a rep's status. Touches lastSeenAt whenever they go to an active
 * state so SMART eligibility / auto-offline stay coherent.
 */
export async function markRepStatus(
  userId: string,
  status: RepAvailabilityStatus
): Promise<RepAvailability> {
  const now = new Date();
  const touch = status === "ONLINE" || status === "BUSY";
  return prisma.repAvailability.upsert({
    where: { userId },
    create: {
      userId,
      status,
      lastSeenAt: touch ? now : null,
    },
    update: {
      status,
      ...(touch ? { lastSeenAt: now } : {}),
    },
  });
}

/**
 * Heartbeat: keep lastSeenAt fresh for an active rep. If the rep had been
 * auto-marked OFFLINE but is clearly active again, flip them back to BUSY
 * (never override a deliberate AWAY/ONLINE choice).
 */
export async function touchRepHeartbeat(
  userId: string
): Promise<RepAvailability> {
  const now = new Date();
  const existing = await prisma.repAvailability.findUnique({
    where: { userId },
    select: { status: true },
  });

  // First touch ever → create as BUSY (active but not deliberately ONLINE).
  if (!existing) {
    return prisma.repAvailability.create({
      data: { userId, status: "BUSY", lastSeenAt: now },
    });
  }

  // Activity after an auto-offline lapse → bring them back online as BUSY.
  const nextStatus =
    existing.status === "OFFLINE" ? ("BUSY" as RepAvailabilityStatus) : undefined;

  return prisma.repAvailability.update({
    where: { userId },
    data: {
      lastSeenAt: now,
      ...(nextStatus ? { status: nextStatus } : {}),
    },
  });
}

/**
 * Auto-offline sweep: mark ONLINE/BUSY reps OFFLINE when their lastSeenAt is
 * older than their own autoOfflineAfterMin (so a closed tab stops drawing
 * leads). AWAY/OFFLINE are left untouched (those are deliberate). Returns the
 * count flipped. Never throws.
 */
export async function autoOfflineIdleReps(): Promise<number> {
  try {
    const now = Date.now();
    const candidates = await prisma.repAvailability.findMany({
      where: { status: { in: ["ONLINE", "BUSY"] } },
      select: {
        id: true,
        lastSeenAt: true,
        autoOfflineAfterMin: true,
      },
    });

    const staleIds: string[] = [];
    for (const rep of candidates) {
      const limitMin = rep.autoOfflineAfterMin ?? DEFAULT_AUTO_OFFLINE_MIN;
      const cutoff = now - limitMin * 60 * 1000;
      // No heartbeat ever, or a stale one → idle.
      if (!rep.lastSeenAt || rep.lastSeenAt.getTime() < cutoff) {
        staleIds.push(rep.id);
      }
    }

    if (staleIds.length === 0) return 0;

    const res = await prisma.repAvailability.updateMany({
      where: { id: { in: staleIds } },
      data: { status: "OFFLINE" },
    });
    return res.count;
  } catch (e) {
    console.error("[autoOfflineIdleReps] error:", e);
    return 0;
  }
}
