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
            <p className="text-meta font-medium uppercase tracking-[0.08em] text-white/60">
              Cash position · all bank accounts
            </p>
            {/* The hero band is overflow-hidden, so an over-long figure is
              * silently CLIPPED rather than pushed out — unacceptable for the
              * headline cash number. At 375px there is ~295px inside the p-6
              * band; text-4xl only fits about 12 characters, and a crore-scale
              * balance is longer than that. Step the type down on phones and
              * allow a break as the last resort. */}
            <p className="mt-1.5 text-h2 font-semibold numeric leading-none break-words sm:text-4xl lg:text-5xl">
              {formatINR(cashPosition)}
            </p>
            <p className="mt-2 text-body text-white/60">
              Live balance from posted ledger movements
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <HeroStat label="Net profit · MTD" value={formatINR(mtdNet)} accent={profitable ? "text-emerald-300" : "text-rose-300"} />
            <HeroStat label="Revenue · MTD" value={formatINR(mtdRevenue)} accent="text-white" sub="Recognized (accrual)" />
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
          <p className="text-center text-detail text-white/65">
            Revenue share of this month&apos;s gross flow · FY {fy}
          </p>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div>
      <p className="text-meta font-medium uppercase tracking-[0.06em] text-white/55">{label}</p>
      <p className={`mt-1 text-xl font-semibold numeric ${accent}`}>{value}</p>
      {sub && <p className="mt-0.5 text-meta text-white/45">{sub}</p>}
    </div>
  );
}
