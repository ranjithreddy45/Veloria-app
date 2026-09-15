import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Bug,
  CheckCircle2,
  Clock,
  Database,
  Mail,
  MessageCircle,
  Tag,
  XCircle,
} from "lucide-react";

import { auth } from "@/../auth";
import { version as appVersion } from "@/../package.json";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "System Health | Settings" };
// Live probes (DB round-trip, cron heartbeats, env presence) — never cache.
export const dynamic = "force-dynamic";

// ============================================================
// System Health — one admin screen answering "is production wired up and
// alive?": cron heartbeats, whether the error / email / WhatsApp / push
// channels are configured, database reachability + latency, and which build
// is running.
//
// Reads env PRESENCE only — no value is ever rendered, not even a prefix.
// WhatsApp lives in the database (WhatsAppConfig), so it is checked there,
// mirroring lib/integrations/health.ts: checking env would report it dead
// while it is live. Integration-by-integration detail (exact variable names,
// what silently breaks) stays on Settings → Integration Health.
// ============================================================

type Tone = "ok" | "warn" | "off";

interface Check {
  key: string;
  label: string;
  icon: typeof Activity;
  tone: Tone;
  summary: string;
  detail?: string;
}

const TONE: Record<
  Tone,
  { cls: string; icon: typeof CheckCircle2; iconCls: string; label: string }
> = {
  ok: {
    cls: "border-primary/30 bg-primary/5",
    icon: CheckCircle2,
    iconCls: "text-primary",
    label: "OK",
  },
  warn: {
    cls: "border-warning/40 bg-warning/10",
    icon: AlertTriangle,
    iconCls: "text-warning",
    label: "Attention",
  },
  off: {
    cls: "border-destructive/30 bg-destructive/10",
    icon: XCircle,
    iconCls: "text-destructive",
    label: "Not configured",
  },
};

const present = (name: string): boolean => Boolean(process.env[name]?.trim());

/** How stale a lane's last run may be before it is flagged. `frequent` is
 *  driven by the hourly GitHub Actions workflow; everything else is nightly. */
const LANE_MAX_AGE_MS: Record<string, number> = {
  frequent: 2 * 60 * 60 * 1000,
  daily: 26 * 60 * 60 * 1000,
};
const DEFAULT_MAX_AGE_MS = 26 * 60 * 60 * 1000;
/** Lanes that must exist even before their first run. */
const EXPECTED_LANES = ["daily", "frequent"];

function ago(from: Date, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function ist(d: Date): string {
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatUptime(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function probeDatabase(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    // Error CLASS only — a Prisma message can carry the database host name.
    return {
      ok: false,
      ms: Math.round(performance.now() - t0),
      error: e instanceof Error ? e.name : "Error",
    };
  }
}

export default async function SystemHealthPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role ?? "")) {
    redirect("/not-authorized");
  }

  const now = new Date();
  const [db, cronRows, waConfig] = await Promise.all([
    probeDatabase(),
    prisma.cronRunLog
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          lane: true,
          status: true,
          total: true,
          failed: true,
          durationMs: true,
          createdAt: true,
        },
      })
      .catch(() => []),
    prisma.whatsAppConfig
      .findFirst({
        where: { isActive: true },
        select: { provider: true, accessToken: true },
      })
      .catch(() => null),
  ]);

  // ---- cron heartbeats: latest row per lane -------------------------------
  type CronRow = (typeof cronRows)[number];
  const latest = new Map<string, CronRow>();
  for (const r of cronRows) if (!latest.has(r.lane)) latest.set(r.lane, r);
  const laneNames = Array.from(new Set([...EXPECTED_LANES, ...latest.keys()]));
  const lanes = laneNames.map((lane) => {
    const row = latest.get(lane) ?? null;
    const maxAge = LANE_MAX_AGE_MS[lane] ?? DEFAULT_MAX_AGE_MS;
    const stale = !row || now.getTime() - row.createdAt.getTime() > maxAge;
    const tone: Tone = !row
      ? "off"
      : row.status === "FAILURE"
        ? "off"
        : stale || row.status === "PARTIAL"
          ? "warn"
          : "ok";
    return { lane, row, stale, tone };
  });

  // ---- configuration checks (presence only) --------------------------------
  const sentryOn = present("NEXT_PUBLIC_SENTRY_DSN");
  const sentryEnv = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
  const emailOn = present("RESEND_API_KEY");
  const whatsappOn = Boolean(waConfig?.accessToken?.trim());
  const pushPublic = present("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const pushFull = pushPublic && present("VAPID_PRIVATE_KEY") && present("VAPID_SUBJECT");

  const checks: Check[] = [
    {
      key: "db",
      label: "Database",
      icon: Database,
      tone: db.ok ? (db.ms > 1500 ? "warn" : "ok") : "off",
      summary: db.ok
        ? `Reachable · ${db.ms} ms round-trip`
        : `Unreachable (${db.error ?? "error"}) after ${db.ms} ms`,
      detail: db.ok
        ? db.ms > 1500
          ? "Slow: over 1.5 s for SELECT 1. Check the Neon region and that the pooled URL is in use."
          : undefined
        : "Every page and cron depends on this. Check DATABASE_URL in the deployment and the Neon status page.",
    },
    {
      key: "sentry",
      label: "Error monitoring (Sentry)",
      icon: Bug,
      tone: sentryOn ? "ok" : "off",
      summary: sentryOn
        ? `Reporting server, edge and browser errors · environment "${sentryEnv}"`
        : "NEXT_PUBLIC_SENTRY_DSN not set — errors only reach the container logs",
      detail: sentryOn
        ? undefined
        : "Set NEXT_PUBLIC_SENTRY_DSN in .env.production (and as a Docker build arg so the browser bundle gets it), then redeploy.",
    },
    {
      key: "email",
      label: "Email (Resend)",
      icon: Mail,
      tone: emailOn ? "ok" : "off",
      summary: emailOn
        ? "RESEND_API_KEY present — transactional email and uptime/backup alerts can send"
        : "RESEND_API_KEY not set — no email leaves the system (OTPs, invoices, alerts)",
    },
    {
      key: "whatsapp",
      label: `WhatsApp${waConfig?.provider ? ` (${waConfig.provider})` : ""}`,
      icon: MessageCircle,
      tone: whatsappOn ? "ok" : "off",
      summary: whatsappOn
        ? "Active configuration with an access token (saved in WhatsApp settings)"
        : "No active WhatsApp configuration — set it up under Settings → Integrations",
    },
    {
      key: "push",
      label: "Push notifications (Web Push)",
      icon: BellRing,
      tone: pushFull ? "ok" : pushPublic ? "warn" : "off",
      summary: pushFull
        ? "VAPID key pair and subject present"
        : pushPublic
          ? "Public key set but VAPID_PRIVATE_KEY / VAPID_SUBJECT missing — push is silently disabled"
          : "NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — no device notifications",
    },
  ];

  const counts: Record<Tone, number> = { ok: 0, warn: 0, off: 0 };
  for (const c of checks) counts[c.tone] += 1;

  // ---- build / runtime -----------------------------------------------------
  const commit =
    process.env.SENTRY_RELEASE ||
    process.env.GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_SENTRY_RELEASE ||
    "";
  const shortCommit = commit ? commit.slice(0, 12) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        accent="blue"
        eyebrow="Settings · Operations"
        title="System Health"
        description="Is production wired up and alive? Cron heartbeats, alerting and messaging channels, database latency, and the build that is running. Refreshes on every visit."
      />

      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-3 text-body">
        <span className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5">
          <span className="numeric font-semibold">{counts.ok}</span> OK
        </span>
        {counts.warn > 0 && (
          <span className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5">
            <span className="numeric font-semibold">{counts.warn}</span> need attention
          </span>
        )}
        {counts.off > 0 && (
          <span className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5">
            <span className="numeric font-semibold text-destructive">{counts.off}</span> not
            configured
          </span>
        )}
        <span className="text-detail text-muted-foreground">Checked {ist(now)} IST</span>
      </div>

      {/* Checks */}
      <ul className="grid gap-3 md:grid-cols-2">
        {checks.map((c) => {
          const tone = TONE[c.tone];
          const StatusIcon = tone.icon;
          const Icon = c.icon;
          return (
            <li key={c.key} className={cn("rounded-lg border px-4 py-3", tone.cls)}>
              <div className="flex flex-wrap items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-semibold text-foreground">{c.label}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-meta uppercase tracking-wide text-muted-foreground">
                  <StatusIcon className={cn("size-3.5", tone.iconCls)} />
                  {tone.label}
                </span>
              </div>
              <p className="mt-1 text-detail text-foreground/80">{c.summary}</p>
              {c.detail && (
                <p className="mt-1.5 text-detail text-muted-foreground">{c.detail}</p>
              )}
            </li>
          );
        })}
      </ul>

      {/* Cron heartbeats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-muted-foreground" />
            Cron heartbeats
          </CardTitle>
          <p className="text-detail text-muted-foreground">
            Last run of each scheduler lane, from CronRunLog. A lane goes amber when its
            last run is older than expected ({" "}
            <span className="numeric">2 h</span> for <code>frequent</code>,{" "}
            <span className="numeric">26 h</span> for the rest) or finished partially, and
            red when it failed or has never run.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
                  <th className="py-2 pr-4 font-medium">Lane</th>
                  <th className="py-2 pr-4 font-medium">State</th>
                  <th className="py-2 pr-4 font-medium">Last run</th>
                  <th className="py-2 pr-4 font-medium">Jobs</th>
                  <th className="py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {lanes.map(({ lane, row, stale, tone }) => {
                  const t = TONE[tone];
                  const StatusIcon = t.icon;
                  return (
                    <tr key={lane} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        <code>{lane}</code>
                      </td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex items-center gap-1.5">
                          <StatusIcon className={cn("size-3.5", t.iconCls)} />
                          {!row
                            ? "Never run"
                            : `${row.status}${stale && row.status !== "FAILURE" ? " · stale" : ""}`}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {row ? (
                          <>
                            <span className="numeric">{ago(row.createdAt, now)}</span>
                            <span className="ml-2 text-meta text-muted-foreground">
                              {ist(row.createdAt)} IST
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 numeric">
                        {row ? (
                          <>
                            {row.total - row.failed}/{row.total} ok
                            {row.failed > 0 && (
                              <span className="ml-1 text-destructive">({row.failed} failed)</span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 numeric">
                        {row ? `${(row.durationMs / 1000).toFixed(1)} s` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Build / runtime */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="size-4 text-muted-foreground" />
            Build &amp; runtime
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b py-1.5 sm:border-0">
              <dt className="text-muted-foreground">App version</dt>
              <dd className="numeric font-medium">v{appVersion}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b py-1.5 sm:border-0">
              <dt className="text-muted-foreground">Commit / release</dt>
              <dd className="font-mono text-detail">
                {shortCommit ?? (
                  <span className="text-muted-foreground">not stamped (set SENTRY_RELEASE)</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b py-1.5 sm:border-0">
              <dt className="text-muted-foreground">Environment</dt>
              <dd className="font-medium">{process.env.NODE_ENV ?? "development"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b py-1.5 sm:border-0">
              <dt className="text-muted-foreground">Node</dt>
              <dd className="numeric">{process.version}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b py-1.5 sm:border-0">
              <dt className="text-muted-foreground">Process up for</dt>
              <dd className="numeric">{formatUptime(process.uptime())}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-muted-foreground">Server time</dt>
              <dd className="numeric">{ist(now)} IST</dd>
            </div>
          </dl>
          <p className="mt-4 text-detail text-muted-foreground">
            The external uptime probe and the nightly database backup run on the host, not
            in this container: <code>/var/log/veloria-uptime.log</code> and{" "}
            <code>/var/log/veloria-backup.log</code> on the VPS (scripts/vps-uptime.sh,
            scripts/vps-backup.sh).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
