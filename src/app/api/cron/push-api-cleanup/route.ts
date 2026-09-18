import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { pushApiConfig } from "@/lib/push-api/config";

/**
 * Daily cron: keep the Push API's bookkeeping tables small.
 *
 *  - Idempotency records past their TTL — a retry that old is a new request.
 *  - Rate-limit counters from windows that ended over two hours ago.
 *  - Request logs older than PUSH_API_LOG_RETENTION_DAYS (90 by default).
 *  - Internal events older than PUSH_API_EVENT_RETENTION_DAYS (90 by default).
 *  - Ingest locks left behind by a crashed request.
 *
 * Leads, touches and external-id links are CRM data and are never touched here.
 * CRON_SECRET auth, same as every other cron job.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (
      !authHeader ||
      !process.env.CRON_SECRET ||
      authHeader.length !== expected.length ||
      !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    const { logRetentionDays, eventRetentionDays } = pushApiConfig();
    const [idempotency, shortCounters, dayCounters, logs, events, locks] = await Promise.all([
      prisma.pushIdempotencyRecord.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
      // Minute and hour windows are finished within the hour; keep two for safety.
      prisma.pushRateLimitCounter.deleteMany({
        where: { window: { in: ["minute", "hour"] }, windowStart: { lt: new Date(now - 2 * 3_600_000) } },
      }),
      // Daily windows (the new-lead cap) must survive the whole UTC day they count.
      prisma.pushRateLimitCounter.deleteMany({
        where: { window: { startsWith: "day" }, windowStart: { lt: new Date(now - 2 * 86_400_000) } },
      }),
      prisma.pushApiRequestLog.deleteMany({ where: { createdAt: { lt: new Date(now - logRetentionDays * 86_400_000) } } }),
      // No consumer reads the outbox yet, so it would otherwise grow forever.
      prisma.integrationEvent.deleteMany({ where: { createdAt: { lt: new Date(now - eventRetentionDays * 86_400_000) } } }),
      // Leases expire on their own; this only clears rows left by crashed holders.
      prisma.pushIngestLock.deleteMany({ where: { lockedUntil: { lt: new Date(now - 3_600_000) } } }),
    ]);

    return NextResponse.json({
      success: true,
      idempotencyRecordsDeleted: idempotency.count,
      rateLimitCountersDeleted: shortCounters.count + dayCounters.count,
      requestLogsDeleted: logs.count,
      integrationEventsDeleted: events.count,
      staleIngestLocksDeleted: locks.count,
    });
  } catch (error) {
    console.error("[cron/push-api-cleanup]", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
