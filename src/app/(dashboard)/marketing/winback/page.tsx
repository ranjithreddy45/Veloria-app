import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RotateCcwIcon, SendIcon, TrophyIcon, FlameIcon } from "lucide-react";

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

import { getWinbackStats, getWinbackTargets } from "@/actions/winback.actions";
import type { WinbackStatus } from "@prisma/client";
import { WinbackRowActions } from "./_components/winback-row-actions";

export const metadata: Metadata = {
  title: "Win-back",
  description: "Owned-demand recovery — abandoned quotes, lost-lead revival, event-proximity nudges",
};

// ============================================================
// Win-back cockpit (Server Component) — read-only funnel over WinbackTarget.
// Gated by marketing:read.
// ============================================================

const KIND_LABEL: Record<string, string> = {
  ABANDONED_QUOTE: "Abandoned quote",
  LOST_LEAD_REVIVAL: "Lost-lead revival",
  EVENT_DATE_PROXIMITY: "Event proximity",
  COOLING_LEAD: "Cooling lead",
  CORPORATE_FARMING: "Corporate farming",
};

const STATUS_VARIANT: Record<WinbackStatus, "default" | "secondary" | "success" | "warning" | "outline" | "destructive"> = {
  PENDING: "secondary",
  ENROLLED: "default",
  CONTACTED: "warning",
  RECOVERED: "success",
  EXHAUSTED: "outline",
  SUPPRESSED: "destructive",
};

export default async function WinbackPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!hasPermission(session.user.role as string, "marketing:read")) {
    redirect("/not-authorized");
  }
  // Operator actions (Suppress / Mark recovered) are gated by marketing:manage;
  // read-only marketing roles still see the cockpit but without the controls.
  const canManage = hasPermission(session.user.role as string, "marketing:manage");

  const [statsRes, targetsRes] = await Promise.all([
    getWinbackStats(),
    getWinbackTargets({ page: 1, limit: 30 }),
  ]);

  const stats = statsRes.success ? statsRes.data : null;
  const targets = targetsRes.success ? targetsRes.data.rows : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="OWNED DEMAND · WIN-BACK"
        title="Win-back"
        description="Re-engaging abandoned quotes, lost leads and near-term unbooked enquiries. Figures reflect the latest daily sweeps."
      />

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Total targets"
            value={stats.totals.targets}
            accent="indigo"
            icon={<RotateCcwIcon />}
          />
          <StatTile
            label="In flight"
            value={stats.totals.enrolled + stats.totals.contacted}
            accent="amber"
            icon={<SendIcon />}
            sub={`${stats.totals.enrolled} enrolled · ${stats.totals.contacted} contacted`}
          />
          <StatTile
            label="Recovered"
            value={stats.totals.recovered}
            accent="emerald"
            icon={<TrophyIcon />}
          />
          <StatTile
            label="Recovery rate"
            value={`${stats.totals.recoveryRate}%`}
            accent="violet"
            icon={<FlameIcon />}
            pct={stats.totals.recoveryRate}
          />
        </div>
      )}

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Funnel by kind</CardTitle>
            <CardDescription>
              Per-channel breakdown of where each recovery cohort sits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Enrolled</TableHead>
                  <TableHead className="text-right">Contacted</TableHead>
                  <TableHead className="text-right">Recovered</TableHead>
                  <TableHead className="text-right">Exhausted</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byKind.map((k) => (
                  <TableRow key={k.kind}>
                    <TableCell className="font-medium">{KIND_LABEL[k.kind] ?? k.kind}</TableCell>
                    <TableCell className="text-right tabular-nums">{k.pending}</TableCell>
                    <TableCell className="text-right tabular-nums">{k.enrolled}</TableCell>
                    <TableCell className="text-right tabular-nums">{k.contacted}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {k.recovered}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{k.exhausted}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{k.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent targets</CardTitle>
          <CardDescription>The latest subjects entered into a win-back flow.</CardDescription>
        </CardHeader>
        <CardContent>
          {targets.length === 0 ? (
            <EmptyState
              icon={<RotateCcwIcon />}
              title="No win-back targets yet"
              description="Targets appear here once the daily win-back sweeps find abandoned quotes, lost leads or near-term unbooked enquiries."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason / window</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Lead</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{KIND_LABEL[t.kind] ?? t.kind}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.lostReason
                        ? t.lostReason
                        : t.eventDate
                        ? new Date(t.eventDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.attempts}</TableCell>
                    <TableCell className="text-muted-foreground">
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
                    {canManage && (
                      <TableCell className="text-right">
                        <WinbackRowActions targetId={t.id} status={t.status} />
                      </TableCell>
                    )}
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
