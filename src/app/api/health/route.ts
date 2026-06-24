import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public heartbeat for uptime monitors. Proves the app is up + the DB is
// reachable, and reports the last run of each cron lane (status + freshness)
// so a stalled or failing scheduler is visible at a glance. No sensitive data.
export async function GET() {
  try {
    const lanes = ["daily", "frequent"] as const;
    const runs = await Promise.all(
      lanes.map((lane) =>
        prisma.cronRunLog.findFirst({
          where: { lane },
          orderBy: { createdAt: "desc" },
          select: { status: true, failed: true, total: true, createdAt: true },
        })
      )
    );
    const crons: Record<string, unknown> = {};
    lanes.forEach((lane, i) => {
      const r = runs[i];
      crons[lane] = r
        ? { status: r.status, failed: r.failed, total: r.total, lastRunAt: r.createdAt }
        : { status: "NEVER_RUN" };
    });
    return NextResponse.json({ ok: true, now: new Date().toISOString(), crons });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 503 }
    );
  }
}
