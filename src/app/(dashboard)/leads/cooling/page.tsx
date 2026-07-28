import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SnowflakeIcon, SendIcon, TrophyIcon, FlameIcon } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

import {
  getCoolingLeadStats,
  listCoolingTargets,
} from "@/actions/cooling-lead.actions";
import type { WinbackStatus } from "@prisma/client";
import { RunSweepButton } from "./run-sweep-button";

export const metadata: Metadata = {
  title: "Cooling Leads",
  description: "Auto re-warm sweep for quiet, decayed mid-funnel leads",
};

// ============================================================
// Cooling-leads cockpit (Server Component) — read-only funnel over
// WinbackTarget(kind=COOLING_LEAD). Gated by leads:read; on-demand sweep
// trigger requires settings:read.
// ============================================================

const STATUS_VARIANT: Record<WinbackStatus, "default" | "secondary" | "success" | "warning" | "outline" | "destructive"> = {
  PENDING: "secondary",
  ENROLLED: "default",
  CONTACTED: "warning",
  RECOVERED: "success",
  EXHAUSTED: "outline",
  SUPPRESSED: "destructive",
};

export default async function CoolingLeadsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!hasPermission(session.user.role as string, "leads:read")) {
    redirect("/not-authorized");
  }

  const canTrigger = hasPermission(session.user.role as string, "settings:read");

  const [statsRes, targetsRes] = await Promise.all([
    getCoolingLeadStats(),
    listCoolingTargets({ page: 1, limit: 30 }),
  ]);

  const stats = statsRes.success ? statsRes.data : null;
  const targets = targetsRes.success ? targetsRes.data.rows : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        icon={SnowflakeIcon}
        accent="cyan"
        eyebrow="Leads · Cooling re-warm"
        title="Cooling Leads"
        description={
          stats
            ? `Quiet ${stats.quietDays}d+ mid-funnel leads below score ${stats.threshold} are auto-enrolled into the re-warm cadence each night.`
            : "Quiet, decayed mid-funnel leads auto-enrolled into the re-warm cadence each night."
        }
      >
        {canTrigger && <RunSweepButton />}
      </PageHeader>

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="At-risk backlog"
            value={stats.atRiskBacklog}
            accent="cyan"
            icon={<SnowflakeIcon />}
            sub="matching predicate, not yet enrolled"
          />
          <StatTile
            label="Enrolled"
            value={stats.enrolled + stats.contacted}
            accent="amber"
            icon={<SendIcon />}
            sub={`${stats.enrolled} active · ${stats.contacted} contacted`}
          />
          <StatTile
            label="Recovered"
            value={stats.recovered}
            accent="emerald"
            icon={<TrophyIcon />}
          />
          <StatTile
            label="Recovery rate"
            value={`${stats.recoveryRate}%`}
            accent="violet"
            icon={<FlameIcon />}
            pct={stats.recoveryRate}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cooling targets</CardTitle>
          <CardDescription>Leads currently in (or recovered from) the re-warm flow.</CardDescription>
        </CardHeader>
        <CardContent>
          {targets.length === 0 ? (
            <EmptyState
              icon={<SnowflakeIcon />}
              title="No cooling targets yet"
              description="Targets appear once the nightly sweep finds quiet, low-score mid-funnel leads — or after you run the sweep on demand. Ensure an ACTIVE 'Cooling Lead Re-warm' cadence (entityType=LEAD) exists first."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.leadTitle ?? "—"}</TableCell>
                    <TableCell className="text-right numeric">{t.score ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.assigneeName ?? "Unassigned"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right numeric">{t.attempts}</TableCell>
                    <TableCell className="numeric text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {t.leadId ? (
                        <Link href={`/leads/${t.leadId}`} className="text-primary hover:underline">
                          View
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
