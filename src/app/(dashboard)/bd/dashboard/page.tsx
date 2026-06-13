import type { Metadata } from "next";
import {
  Users,
  CheckCircle2,
  Handshake,
  Trophy,
  Building2,
  Gauge,
  AlertTriangle,
} from "lucide-react";
import { getAcqLeads } from "@/actions/acq-lead.actions";
import { getAcqDeals } from "@/actions/acq-deal.actions";
import { getAcqProperties } from "@/actions/acq-property.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Card, CardContent } from "@/components/ui/card";
import {
  ACQ_DEAL_STAGE_LABEL,
  type AcqDealStage,
} from "@/lib/acq/constants";

export const metadata: Metadata = { title: "BD Dashboard" };

// Always recompute from live data — the funnel/KPIs must never serve a stale cached
// payload (BUG-001). Mutations also revalidatePath("/bd/dashboard").
export const dynamic = "force-dynamic";

// ------------------------------------------------------------
// Serialized row shapes (subset of fields this view consumes).
// ------------------------------------------------------------
interface LeadRow {
  id: string;
  status: string;
  firstContactDue: string | null;
  firstContactAt: string | null;
  createdAt: string;
}

interface DealRow {
  id: string;
  stage: string;
  lostReason: string | null;
  evalScore: number | null;
}

interface PropertyRow {
  id: string;
  status: string;
}

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}

function KpiCard({ label, value, icon: Icon }: KpiCardProps) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex items-center justify-between gap-3 px-4 py-4">
        <div className="space-y-1">
          <div className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {label}
          </div>
          <div className="text-[22px] font-semibold leading-none tabular-nums text-foreground">
            {value.toLocaleString("en-IN")}
          </div>
        </div>
        <Icon className="size-5 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

interface FunnelRow {
  label: string;
  count: number;
}

function FunnelBar({ row, max }: { row: FunnelRow; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((row.count / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-[13px] text-muted-foreground sm:w-40">
        {row.label}
      </div>
      <div className="relative h-7 flex-1 overflow-hidden rounded-lg border border-border bg-muted/30">
        <div
          className="h-full rounded-lg bg-indigo-500/20"
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center px-3 text-[13px] font-medium tabular-nums text-foreground">
          {row.count.toLocaleString("en-IN")}
        </div>
      </div>
    </div>
  );
}

export default async function BdDashboardPage() {
  const [leadsRes, dealsRes, propsRes] = await Promise.all([
    getAcqLeads(),
    getAcqDeals(),
    getAcqProperties(),
  ]);

  const leads = leadsRes.success ? (leadsRes.data as LeadRow[]) : [];
  const deals = dealsRes.success ? (dealsRes.data as DealRow[]) : [];
  const properties = propsRes.success ? (propsRes.data as PropertyRow[]) : [];

  // ---- KPIs ----
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter((l) => l.status === "QUALIFIED").length;
  const activeDeals = deals.filter(
    (d) => d.stage !== "WON" && d.stage !== "LOST"
  ).length;
  const wonDeals = deals.filter((d) => d.stage === "WON").length;
  const availableProperties = properties.filter(
    (p) => p.status === "AVAILABLE"
  ).length;

  // ---- Funnel (cumulative: each stage counts records that reached AT LEAST it,
  // so the funnel is always monotonic — a deal that jumped to WON still counts
  // toward every earlier stage). LOST/ON_HOLD are terminal and excluded here;
  // lost deals are summarised in the Loss-reasons panel. (BUG-002) ----
  const LINEAR_STAGES = [
    "QUALIFIED", "EVALUATION", "EVALUATION_COMPLETED", "PROPOSAL_SENT",
    "NEGOTIATION", "CONTRACT_SENT", "SIGNED", "WON",
  ] as const;
  const linearOf = (stage: string) => (LINEAR_STAGES as readonly string[]).indexOf(stage);
  const dealFunnel = LINEAR_STAGES.map((stage, i) => ({
    label: ACQ_DEAL_STAGE_LABEL[stage as AcqDealStage],
    count: deals.filter((d) => {
      const li = linearOf(d.stage);
      return li >= 0 && li >= i; // reached at least this stage
    }).length,
  }));

  const funnel: FunnelRow[] = [
    { label: "Leads (total)", count: totalLeads },
    { label: "Qualified Leads", count: qualifiedLeads },
    ...dealFunnel,
    { label: "Properties Available", count: availableProperties },
  ];
  // Bars scale to the top of the funnel so widths are visually non-increasing.
  const funnelMax = funnel.length > 0 ? funnel[0].count : 0;

  // ---- Loss reasons ----
  const lostDeals = deals.filter((d) => d.stage === "LOST");
  const lossCounts = new Map<string, number>();
  for (const d of lostDeals) {
    const reason = d.lostReason ?? "UNSPECIFIED";
    lossCounts.set(reason, (lossCounts.get(reason) ?? 0) + 1);
  }
  const lossReasons = Array.from(lossCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // ---- Average evaluation score ----
  const scored = deals.filter(
    (d): d is DealRow & { evalScore: number } => d.evalScore !== null
  );
  const avgEvalScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, d) => sum + d.evalScore, 0) / scored.length
        )
      : null;

  // ---- SLA breaches ----
  const now = Date.now();
  const slaBreaches = leads.filter(
    (l) =>
      l.status === "NEW" &&
      !l.firstContactAt &&
      l.firstContactDue !== null &&
      new Date(l.firstContactDue).getTime() < now
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="BD Dashboard"
        help={<PageHelp id="bd-dashboard" />}
        description="Acquisition funnel, losses, and SLAs at a glance."
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Total Leads" value={totalLeads} icon={Users} />
        <KpiCard
          label="Qualified Leads"
          value={qualifiedLeads}
          icon={CheckCircle2}
        />
        <KpiCard label="Active Deals" value={activeDeals} icon={Handshake} />
        <KpiCard label="Won Deals" value={wonDeals} icon={Trophy} />
        <KpiCard
          label="Available for Sales"
          value={availableProperties}
          icon={Building2}
        />
      </div>

      {/* Funnel */}
      <Card className="gap-0 py-0">
        <CardContent className="space-y-4 px-5 py-5">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
            Funnel
          </h2>
          <div className="space-y-2">
            {funnel.map((row) => (
              <FunnelBar key={row.label} row={row} max={funnelMax} />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Loss reasons */}
        <Card className="gap-0 py-0 lg:col-span-2">
          <CardContent className="space-y-4 px-5 py-5">
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
              Loss reasons
            </h2>
            {lossReasons.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No lost deals yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {lossReasons.map(({ reason, count }) => (
                  <li
                    key={reason}
                    className="flex items-center justify-between gap-3 text-[13px]"
                  >
                    <span className="truncate text-muted-foreground">
                      {reason}
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {count.toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Stats: avg eval score + SLA breaches */}
        <div className="flex flex-col gap-4">
          <Card className="gap-0 py-0">
            <CardContent className="space-y-1.5 px-5 py-5">
              <div className="flex items-center gap-2 text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                <Gauge className="size-3.5" />
                Average evaluation score
              </div>
              <div className="text-[22px] font-semibold leading-none tabular-nums text-foreground">
                {avgEvalScore === null ? "—" : avgEvalScore}
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardContent className="space-y-1.5 px-5 py-5">
              <div className="flex items-center gap-2 text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                <AlertTriangle className="size-3.5" />
                SLA breaches
              </div>
              <div className="text-[15px] font-semibold tabular-nums text-red-600 dark:text-red-400">
                {slaBreaches.toLocaleString("en-IN")} leads past first-contact SLA
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
