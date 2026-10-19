import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, CalendarClock, Inbox, Sparkles, Timer, Trophy, UserX, Wallet } from "lucide-react";
import { getSalesTeamDashboard, type TeamDashboardRow } from "@/actions/sales-team.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamChip, TeamSwitcher } from "@/components/crm/team-switcher";
import { UNSORTED } from "@/lib/crm/sales-team";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Team Dashboard" };
export const dynamic = "force-dynamic";

// ============================================================
// /sales/teams — the Wedding, Corporate and Social CRMs side by side. A rep
// sees their own team; sales heads and admins see every team (or pick one).
// Every figure is a live count over Lead rows — nothing estimated.
// ============================================================

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

function fmtMins(m: number | null): string {
  if (m === null) return "—";
  if (m < 60) return `${m} min`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)} h`;
  return `${(m / 1440).toFixed(1)} d`;
}

/** Where "open this team's leads" goes: managers get the team filter, reps their team tab. */
function leadsHref(key: string, canSwitch: boolean, extra?: Record<string, string>): string {
  const params = new URLSearchParams(canSwitch ? { scope: "all", team: key, ...extra } : { scope: "team", ...extra });
  return `/leads?${params.toString()}`;
}

export default async function TeamDashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const days = Number(first(sp.days)) || 30;
  const res = await getSalesTeamDashboard({ team: first(sp.team), days });

  if (!res.success) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team Dashboard" eyebrow="Sales CRM · Teams" />
        <Card>
          <CardContent className="py-10 text-center text-body text-muted-foreground">{res.error}</CardContent>
        </Card>
      </div>
    );
  }

  const { rows, canSwitch, days: period } = res.data;
  const single = rows.length === 1 ? rows[0] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Dashboard"
        eyebrow="Sales CRM · Teams"
        description={
          canSwitch
            ? "Each sales team's leads, response and wins. Pick a team to see its reps."
            : "Your team's leads, response and wins."
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {canSwitch && <TeamSwitcher value={single ? single.key : null} />}
        <div className="flex items-center gap-0.5 rounded-xl border border-border/70 bg-muted/40 p-0.5">
          {[7, 30, 90].map((d) => {
            const params = new URLSearchParams();
            const team = first(sp.team);
            if (team) params.set("team", team);
            params.set("days", String(d));
            return (
              <Link
                key={d}
                href={`/sales/teams?${params.toString()}`}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-detail font-medium transition-colors",
                  period === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d} days
              </Link>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="You're not in a sales team yet"
            description="Ask your sales head to put you in the Wedding, Corporate or Social team. Until then your leads list shows the leads assigned to you."
          />
        </Card>
      ) : single ? (
        <TeamDetail row={single} canSwitch={canSwitch} days={period} />
      ) : (
        <>
          <Card>
            <CardContent className="py-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                    <TableHead className="text-right">New ({period}d)</TableHead>
                    <TableHead className="text-right">No owner</TableHead>
                    <TableHead className="text-right">Follow-ups due</TableHead>
                    <TableHead className="text-right">First reply overdue</TableHead>
                    <TableHead className="text-right">Median first reply</TableHead>
                    <TableHead className="text-right">Won ({period}d)</TableHead>
                    <TableHead className="text-right">Won value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>
                        <Link href={`/sales/teams?team=${r.key}&days=${period}`} className="hover:underline">
                          <TeamChip team={r.key === UNSORTED ? null : r.key} />
                        </Link>
                      </TableCell>
                      <TableCell className="numeric text-right">
                        <Link href={leadsHref(r.key, canSwitch)} className="hover:underline">
                          {r.open}
                        </Link>
                      </TableCell>
                      <TableCell className="numeric text-right">{r.newInPeriod}</TableCell>
                      <TableCell className={cn("numeric text-right", r.noOwner > 0 && "text-amber-700 dark:text-amber-400")}>
                        {r.noOwner}
                      </TableCell>
                      <TableCell className="numeric text-right">{r.followUpsDue}</TableCell>
                      <TableCell className={cn("numeric text-right", r.awaitingFirstReply > 0 && "text-destructive")}>
                        {r.awaitingFirstReply}
                      </TableCell>
                      <TableCell className="numeric text-right">{fmtMins(r.medianFirstReplyMins)}</TableCell>
                      <TableCell className="numeric text-right">{r.wonInPeriod}</TableCell>
                      <TableCell className="numeric text-right">{inr(r.wonValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            {rows
              .filter((r) => r.key !== UNSORTED)
              .map((r) => (
                <RepsCard key={r.key} row={r} days={period} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function TeamDetail({ row, canSwitch, days }: { row: TeamDashboardRow; canSwitch: boolean; days: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Open leads" value={row.open} accent="indigo" icon={<Inbox className="size-4" />} />
        <StatTile label={`New · ${days} days`} value={row.newInPeriod} accent="blue" icon={<Sparkles className="size-4" />} />
        <StatTile label="No owner" value={row.noOwner} accent="amber" icon={<UserX className="size-4" />} />
        <StatTile label="Follow-ups due" value={row.followUpsDue} accent="pink" icon={<CalendarClock className="size-4" />} />
        <StatTile
          label="First reply overdue"
          value={row.awaitingFirstReply}
          accent="rose"
          icon={<AlarmClock className="size-4" />}
        />
        <StatTile
          label="Median first reply"
          value={fmtMins(row.medianFirstReplyMins)}
          accent="teal"
          icon={<Timer className="size-4" />}
          sub={`Leads created in the last ${days} days`}
        />
        <StatTile label={`Won · ${days} days`} value={row.wonInPeriod} accent="emerald" icon={<Trophy className="size-4" />} />
        <StatTile label="Won value" value={inr(row.wonValue)} accent="emerald" icon={<Wallet className="size-4" />} />
      </div>
      <div className="flex flex-wrap gap-2 text-detail">
        <Link href={leadsHref(row.key, canSwitch)} className="font-medium text-primary hover:underline">
          Open {row.label === "Unsorted" ? "Unsorted" : `the ${row.label} team's`} leads →
        </Link>
      </div>
      {row.key !== UNSORTED && <RepsCard row={row} days={days} />}
    </div>
  );
}

function RepsCard({ row, days }: { row: TeamDashboardRow; days: number }) {
  return (
    <Card>
      <CardContent className="space-y-3 py-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-body font-semibold">{row.label} team · by rep</p>
          <TeamChip team={row.key} />
        </div>
        {row.reps.length === 0 ? (
          <p className="py-4 text-center text-detail text-muted-foreground">No open leads and no wins in the last {days} days.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {row.reps.map((r) => (
              <li key={r.id ?? "none"} className="flex items-center justify-between gap-3 py-2">
                <span className={cn("truncate text-body", r.id === null && "text-amber-700 dark:text-amber-400")}>{r.name}</span>
                <span className="shrink-0 text-detail text-muted-foreground">
                  <span className="numeric font-semibold text-foreground">{r.open}</span> open ·{" "}
                  <span className="numeric font-semibold text-foreground">{r.wonInPeriod}</span> won
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
