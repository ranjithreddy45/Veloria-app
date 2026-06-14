// ============================================================
// CockpitHero — the plum hero band. Cash position big on the left, a net-MTD
// readout, and a profitability donut (revenue share of revenue+expense) on
// the right. Pure presentation; numbers are pre-derived server-side.
// ============================================================

import { Donut } from "@/components/ui/donut";
import { formatINR } from "@/lib/utils";

interface CockpitHeroProps {
  fy: string;
  cashPosition: number;
  mtdRevenue: number;
  mtdExpense: number;
  mtdNet: number;
}

export function CockpitHero({ fy, cashPosition, mtdRevenue, mtdExpense, mtdNet }: CockpitHeroProps) {
  const denom = mtdRevenue + mtdExpense;
  const revShare = denom > 0 ? Math.round((mtdRevenue / denom) * 100) : 0;
  const profitable = mtdNet >= 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D1B3D] to-[#43295c] p-6 text-white shadow-card sm:p-8">
      <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr] sm:items-center">
        <div className="space-y-6">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-white/60">
              Cash position · all bank accounts
            </p>
            <p className="mt-1.5 text-4xl font-semibold tabular-nums leading-none sm:text-5xl">
              {formatINR(cashPosition)}
            </p>
            <p className="mt-2 text-[13px] text-white/60">
              Live balance from posted ledger movements
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <HeroStat label="Net profit · MTD" value={formatINR(mtdNet)} accent={profitable ? "text-emerald-300" : "text-rose-300"} />
            <HeroStat label="Revenue · MTD" value={formatINR(mtdRevenue)} accent="text-white" />
            <HeroStat label="Expense · MTD" value={formatINR(mtdExpense)} accent="text-white" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3">
          <Donut
            value={revShare}
            size={148}
            thickness={12}
            colorClass={profitable ? "text-emerald-300" : "text-rose-300"}
            trackClass="stroke-white/15"
            label={`${revShare}%`}
            ariaLabel={`Revenue is ${revShare}% of this month's gross flow`}
          />
          <p className="text-center text-[12px] text-white/65">
            Revenue share of this month&apos;s gross flow · FY {fy}
          </p>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-white/55">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}
