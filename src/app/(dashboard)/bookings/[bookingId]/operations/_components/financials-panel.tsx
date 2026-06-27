import {
  TrendingUpIcon,
  TrendingDownIcon,
  WalletIcon,
  ChefHatIcon,
  ShoppingCartIcon,
  AlertTriangleIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatINR } from "@/lib/utils";
import type { EventOpsFinancials } from "@/actions/ops-financials.actions";

// ============================================================
// Financials Panel — per-event budget-vs-actual so margin is
// protected. Pure presentation over getEventOpsFinancials().
// ============================================================

export function FinancialsPanel({ fin }: { fin: EventOpsFinancials }) {
  const marginPositive = Number(fin.grossMargin) >= 0;
  const hasVariances = fin.variances.length > 0;
  const redCount = fin.variances.filter((v) => v.level === "red").length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <WalletIcon className="size-5 text-indigo-600" />
            Event Financials
          </CardTitle>

          {marginPositive ? (
            <Badge className="w-fit border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {fin.grossMarginPct}% margin
            </Badge>
          ) : (
            <Badge className="w-fit border-rose-200 bg-rose-100 text-rose-700 hover:bg-rose-100">
              Running at a loss
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Headline figures */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="Revenue" value={formatINR(fin.revenue)} />
          <Figure
            label="Ops cost"
            value={formatINR(fin.opsCostTotal)}
            tone="muted"
          />
          <Figure
            label="Gross margin"
            value={formatINR(fin.grossMargin)}
            tone={marginPositive ? "positive" : "negative"}
            icon={
              marginPositive ? (
                <TrendingUpIcon className="size-3.5" />
              ) : (
                <TrendingDownIcon className="size-3.5" />
              )
            }
          />
          <Figure
            label="Margin %"
            value={`${fin.grossMarginPct}%`}
            tone={marginPositive ? "positive" : "negative"}
          />
        </div>

        {/* Cost breakdown bar */}
        <CostBar fin={fin} />

        {/* Food-cost % vs target line */}
        <RatioBar
          label="Food cost of revenue"
          icon={<ChefHatIcon className="size-3.5" />}
          pct={fin.foodCostPct}
          targetPct={fin.foodCostTargetPct}
          amount={fin.foodCost}
          suffix={
            fin.usingActualFoodCost
              ? "actual"
              : fin.hasKitchenPlan
                ? "estimate"
                : "no kitchen plan"
          }
        />

        {/* Ops-cost % vs target line */}
        <RatioBar
          label="Ops cost of revenue"
          icon={<ShoppingCartIcon className="size-3.5" />}
          pct={fin.opsCostPct}
          targetPct={fin.opsCostTargetPct}
          amount={fin.opsCostTotal}
          suffix={`${fin.procurementCount} requisition${
            fin.procurementCount === 1 ? "" : "s"
          }`}
        />

        {/* Variance flags */}
        {hasVariances && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangleIcon
                className={cn(
                  "size-4",
                  redCount > 0 ? "text-rose-600" : "text-amber-600"
                )}
              />
              Concerns
              <span className="text-muted-foreground text-xs font-normal">
                {fin.variances.length} flagged
              </span>
            </div>
            <ul className="space-y-2">
              {fin.variances.map((v) => (
                <li
                  key={v.key}
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    v.level === "red"
                      ? "border-rose-200 bg-rose-50"
                      : "border-amber-200 bg-amber-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <span
                        className={cn(
                          "text-sm font-medium leading-tight",
                          v.level === "red"
                            ? "text-rose-800"
                            : "text-amber-800"
                        )}
                      >
                        {v.label}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          v.level === "red"
                            ? "text-rose-700"
                            : "text-amber-700"
                        )}
                      >
                        {v.detail}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-xs capitalize",
                        v.level === "red"
                          ? "border-rose-200 bg-white text-rose-700"
                          : "border-amber-200 bg-white text-amber-700"
                      )}
                    >
                      {v.level === "red" ? "High" : "Watch"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Bits
// ------------------------------------------------------------

function Figure({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "positive" | "negative";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : tone === "muted"
          ? "text-foreground/80"
          : "text-foreground";

  return (
    <div className="bg-muted/40 rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={cn(
          "mt-1 flex items-center gap-1 text-lg font-semibold tabular-nums",
          toneClass
        )}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}

// Stacked bar: food cost vs procurement vs remaining margin, of revenue.
function CostBar({ fin }: { fin: EventOpsFinancials }) {
  const revenue = Number(fin.revenue);
  const food = Number(fin.foodCost);
  const proc = Number(fin.procurementCost);
  const margin = Number(fin.grossMargin);

  // Denominator: revenue when positive, else total cost so bars still render.
  const denom = revenue > 0 ? revenue : food + proc || 1;
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / denom) * 100))}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Where revenue goes</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatINR(fin.revenue)}
        </span>
      </div>
      <div className="bg-muted flex h-3 w-full overflow-hidden rounded-full">
        <div
          className="bg-amber-400"
          style={{ width: w(food) }}
          title={`Food cost ${formatINR(fin.foodCost)}`}
        />
        <div
          className="bg-sky-400"
          style={{ width: w(proc) }}
          title={`Procurement ${formatINR(fin.procurementCost)}`}
        />
        <div
          className={cn(margin >= 0 ? "bg-emerald-400" : "bg-rose-400")}
          style={{ width: w(Math.abs(margin)) }}
          title={`Gross margin ${formatINR(fin.grossMargin)}`}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Legend dot="bg-amber-400" label="Food" value={formatINR(fin.foodCost)} />
        <Legend
          dot="bg-sky-400"
          label="Procurement"
          value={formatINR(fin.procurementCost)}
        />
        <Legend
          dot={margin >= 0 ? "bg-emerald-400" : "bg-rose-400"}
          label={margin >= 0 ? "Margin" : "Loss"}
          value={formatINR(fin.grossMargin)}
        />
      </div>
    </div>
  );
}

function Legend({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", dot)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </span>
  );
}

// Single ratio bar with a target tick line.
function RatioBar({
  label,
  icon,
  pct,
  targetPct,
  amount,
  suffix,
}: {
  label: string;
  icon: React.ReactNode;
  pct: number;
  targetPct: number;
  amount: string;
  suffix?: string;
}) {
  const over = pct > targetPct;
  const fillWidth = `${Math.max(0, Math.min(100, pct))}%`;
  const targetLeft = `${Math.max(0, Math.min(100, targetPct))}%`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            over ? "text-rose-600" : "text-emerald-600"
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="bg-muted relative h-2.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full",
            over ? "bg-rose-500" : "bg-emerald-500"
          )}
          style={{ width: fillWidth }}
        />
        {/* target tick */}
        <div
          className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-foreground/40"
          style={{ left: targetLeft }}
          title={`Target ${targetPct}%`}
        />
      </div>
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>
          {formatINR(amount)}
          {suffix ? ` · ${suffix}` : ""}
        </span>
        <span>Target {targetPct}%</span>
      </div>
    </div>
  );
}
