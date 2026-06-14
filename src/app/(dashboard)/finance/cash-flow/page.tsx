import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Wallet, TrendingDown, LineChart, Gauge, Info, BarChart3,
} from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { formatINR } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { getCashForecast } from "@/actions/finance-cashflow.actions";
import { StressToggle } from "../_components/cash-stress-toggle";
import { CashFlowTable } from "../_components/cash-flow-table";

export const metadata = { title: "Cash Flow · Veloria Grand" };

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ stress?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");

  const { stress: stressParam } = await searchParams;
  const stress = stressParam === "1" || stressParam === "true";

  const forecast = await getCashForecast(stress);

  const runwayAccent =
    forecast.runwayWeekIndex === -1 ? "emerald"
      : forecast.runwayWeekIndex <= 4 ? "rose"
        : "amber";

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        eyebrow="Finance · Cash Flow"
        title="13-Week Cash Flow"
        description="A rolling forecast of cash on hand — open receivables flowing in against an estimated weekly burn — and how many weeks of runway that leaves."
      >
        <StressToggle stress={stress} />
      </PageHeader>

      {!forecast.hasData ? (
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState
            icon={<BarChart3 className="size-5" />}
            title="No ledger data yet"
            description="The cash-flow forecast is derived from posted journal entries and open invoices. Post some entries or send invoices, then this view will fill in."
            action={
              <Link
                href="/finance"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Go to Finance
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Cash now"
              value={formatINR(forecast.cashNow)}
              accent="blue"
              icon={<Wallet className="size-4" />}
              sub="Bank GL balance (posted)"
            />
            <StatTile
              label="Projected · week 13"
              value={formatINR(forecast.projectedEnd)}
              accent={forecast.projectedEnd < 0 ? "rose" : "violet"}
              icon={<LineChart className="size-4" />}
              sub="End of the 13-week horizon"
            />
            <StatTile
              label="Weekly burn"
              value={formatINR(forecast.weeklyBurn)}
              accent="amber"
              icon={<TrendingDown className="size-4" />}
              sub="Avg outflow · last 8 weeks"
            />
            <StatTile
              label="Runway"
              value={forecast.runwayLabel}
              accent={runwayAccent}
              icon={<Gauge className="size-4" />}
              sub={
                forecast.runwayWeekIndex === -1
                  ? "Balance stays positive"
                  : "First week cash goes negative"
              }
            />
          </div>

          <CashFlowTable
            rows={forecast.rows}
            cashNow={forecast.cashNow}
            openReceivables={forecast.openReceivables}
            stress={forecast.stress}
          />

          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" />
            <span>
              Outflow is an <span className="font-medium">estimate</span> — a flat
              weekly run-rate from the average posted expense over the last 8 weeks,
              not a scheduled bill list. Inflows are open receivables bucketed by
              their due date.
              {forecast.stress
                ? " Stress mode slips every expected collection 2 weeks later."
                : ""}
            </span>
          </p>
        </>
      )}
    </div>
  );
}
