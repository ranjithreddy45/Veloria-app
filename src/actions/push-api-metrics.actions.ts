"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// ============================================================
// Push API metrics, derived entirely from PushApiRequestLog (spec clause 24).
// Returns aggregates only — never IP hashes, user agents or lead ids.
// ============================================================

const AUTH_FAILURE_CODES = [
  "UNAUTHORIZED",
  "API_KEY_REVOKED",
  "API_KEY_EXPIRED",
  "INSUFFICIENT_SCOPE",
  "SOURCE_NOT_ALLOWED",
  "TOO_MANY_FAILED_ATTEMPTS",
];
const RATE_LIMIT_CODES = ["RATE_LIMITED", "LEAD_CAP_REACHED"];
const ERROR_OUTCOMES = ["rejected", "error"];

export interface PushApiWindowMetrics {
  total: number;
  created: number;
  updated: number;
  duplicate: number;
  replayed: number;
  rejected: number;
  validationErrors: number;
  authFailures: number;
  rateLimited: number;
  serverErrors: number;
  p50Ms: number | null;
  p95Ms: number | null;
}

export interface PushApiKeyMetrics {
  apiKeyPrefix: string | null;
  count: number;
  errors: number;
}

export interface PushApiMetricsData {
  generatedAt: string;
  last24h: PushApiWindowMetrics;
  last7d: PushApiWindowMetrics;
  byKey24h: PushApiKeyMetrics[];
}

async function windowMetrics(since: Date): Promise<PushApiWindowMetrics> {
  const where = { createdAt: { gte: since } };
  // createdAt is `timestamp without time zone` holding UTC, and the DB session
  // runs in America/New_York — so bind the bound as a UTC ISO string cast to
  // ::timestamp (the trailing Z is ignored), never as a Date/timestamptz.
  const sinceIso = since.toISOString();

  const [byOutcome, byErrorCode, serverErrors, latency] = await Promise.all([
    prisma.pushApiRequestLog.groupBy({ by: ["outcome"], where, _count: { _all: true } }),
    prisma.pushApiRequestLog.groupBy({
      by: ["errorCode"],
      where: { ...where, errorCode: { in: ["VALIDATION_ERROR", ...AUTH_FAILURE_CODES, ...RATE_LIMIT_CODES] } },
      _count: { _all: true },
    }),
    prisma.pushApiRequestLog.count({
      where: { ...where, OR: [{ outcome: "error" }, { responseStatus: { gte: 500 } }] },
    }),
    prisma.$queryRaw<{ p50: number | null; p95: number | null }[]>`
      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs") AS p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") AS p95
      FROM "PushApiRequestLog"
      WHERE "createdAt" >= ${sinceIso}::timestamp
    `,
  ]);

  const outcome = (name: string) => byOutcome.find((r) => r.outcome === name)?._count._all ?? 0;
  const codes = (list: string[]) =>
    byErrorCode.reduce((sum, r) => (r.errorCode && list.includes(r.errorCode) ? sum + r._count._all : sum), 0);
  const round = (v: unknown) => (v == null ? null : Math.round(Number(v)));

  return {
    total: byOutcome.reduce((sum, r) => sum + r._count._all, 0),
    created: outcome("created"),
    updated: outcome("updated"),
    duplicate: outcome("duplicate"),
    replayed: outcome("replayed"),
    rejected: outcome("rejected"),
    validationErrors: codes(["VALIDATION_ERROR"]),
    authFailures: codes(AUTH_FAILURE_CODES),
    rateLimited: codes(RATE_LIMIT_CODES),
    serverErrors,
    p50Ms: round(latency[0]?.p50),
    p95Ms: round(latency[0]?.p95),
  };
}

export async function getPushApiMetrics() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = Date.now();
    const since24h = new Date(now - 24 * 3_600_000);
    const since7d = new Date(now - 7 * 24 * 3_600_000);

    const [last24h, last7d, keyTotals, keyErrors] = await Promise.all([
      windowMetrics(since24h),
      windowMetrics(since7d),
      prisma.pushApiRequestLog.groupBy({
        by: ["apiKeyPrefix"],
        where: { createdAt: { gte: since24h } },
        _count: { _all: true },
      }),
      prisma.pushApiRequestLog.groupBy({
        by: ["apiKeyPrefix"],
        where: { createdAt: { gte: since24h }, OR: [{ outcome: { in: ERROR_OUTCOMES } }, { responseStatus: { gte: 400 } }] },
        _count: { _all: true },
      }),
    ]);

    const byKey24h: PushApiKeyMetrics[] = keyTotals
      .map((r) => ({
        apiKeyPrefix: r.apiKeyPrefix,
        count: r._count._all,
        errors: keyErrors.find((e) => e.apiKeyPrefix === r.apiKeyPrefix)?._count._all ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    const data: PushApiMetricsData = { generatedAt: new Date(now).toISOString(), last24h, last7d, byKey24h };
    return { success: true as const, data };
  } catch (error) {
    console.error("getPushApiMetrics error:", error);
    return { success: false as const, error: "Failed to load Push API metrics" };
  }
}
