import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Building2, IndianRupee, ShieldAlert } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { formatINR, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getPortfolio } from "@/actions/project-portfolio.actions";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "projects:read")) redirect("/projects");
  const data = await getPortfolio();
  if (!data) redirect("/projects");

  const { rows, summary } = data;

  return (
    <div className="space-y-5">
      <PageHeader title="Portfolio" description="Every in-flight venue at a glance — phase, open critical snags, budget variance and risk." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Building2 className="size-4" />} label="Active venues" value={String(summary.total)} accent />
        <Kpi icon={<AlertTriangle className="size-4" />} label="At risk" value={String(summary.atRisk)} danger={summary.atRisk > 0} />
        <Kpi icon={<ShieldAlert className="size-4" />} label="Open critical snags" value={String(summary.openCritical)} danger={summary.openCritical > 0} />
        <Kpi icon={<IndianRupee className="size-4" />} label="Committed / estimate" value={`${formatINR(summary.committed)} / ${formatINR(summary.estimate)}`} className="col-span-2 lg:col-span-1" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No active venue projects.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Target ready</TableHead>
                <TableHead className="text-right">Open snags</TableHead>
                <TableHead className="text-right">Committed / est.</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link href={`/projects/${r.id}`} className="hover:underline">{r.name}</Link>
                    {r.city && <span className="ml-1.5 text-meta text-muted-foreground">{r.city}</span>}
                  </TableCell>
                  <TableCell><StatusPill label={r.phase.replace(/_/g, " ")} hue={r.phase === "LIVE" ? "emerald" : "amber"} size="xs" /></TableCell>
                  <TableCell className="text-body text-muted-foreground">
                    {r.targetReadyDate ? formatDate(r.targetReadyDate) : "—"}{r.overdue && <span className="ml-1.5 text-red-600">overdue</span>}
                  </TableCell>
                  <TableCell className="text-right text-body tabular-nums">
                    {r.openCritical > 0 && <span className="text-red-600">{r.openCritical} critical</span>}
                    {r.openCritical > 0 && r.openMajor > 0 && " · "}
                    {r.openMajor > 0 && <span className="text-amber-600">{r.openMajor} major</span>}
                    {r.openCritical === 0 && r.openMajor === 0 && <span className="text-muted-foreground/60">—</span>}
                  </TableCell>
                  <TableCell className={`text-right text-body tabular-nums ${r.overBudget ? "text-red-600 font-medium" : ""}`}>
                    {formatINR(r.committed)} / {formatINR(r.estimate)}
                  </TableCell>
                  <TableCell>
                    {r.atRisk ? <StatusPill label="At risk" hue="red" size="xs" /> : <StatusPill label="On track" hue="emerald" size="xs" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// `className` exists so a tile carrying a long money string can claim both
// columns on a phone. The value also steps down to text-xl and is allowed to
// break: these tiles sit 2-up at 375px (~133px of inner width) and a figure like
// "₹1,20,00,000 / ₹1,50,00,000" would otherwise spill out of the card.
function Kpi({ icon, label, value, accent, danger, className }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; danger?: boolean; className?: string }) {
  return (
    <div className={`rounded-xl border bg-card p-4 ${className ?? ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground"><span className={danger ? "text-red-600" : accent ? "text-primary" : ""}>{icon}</span><span className="text-detail font-medium">{label}</span></div>
      <div className={`mt-2 text-xl font-semibold tabular-nums break-words sm:text-2xl ${danger ? "text-red-700" : ""}`}>{value}</div>
    </div>
  );
}
