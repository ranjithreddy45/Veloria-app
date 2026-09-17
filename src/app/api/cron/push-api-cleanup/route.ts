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
    const { logRetentionDays } = pushApiConfig();
    const [idempotency, counters, logs] = await Promise.all([
      prisma.pushIdempotencyRecord.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
      prisma.pushRateLimitCounter.deleteMany({ where: { windowStart: { lt: new Date(now - 2 * 3_600_000) } } }),
      prisma.pushApiRequestLog.deleteMany({ where: { createdAt: { lt: new Date(now - logRetentionDays * 86_400_000) } } }),
    ]);

    return NextResponse.json({
      success: true,
      idempotencyRecordsDeleted: idempotency.count,
      rateLimitCountersDeleted: counters.count,
      requestLogsDeleted: logs.count,
    });
  } catch (error) {
    console.error("[cron/push-api-cleanup]", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
