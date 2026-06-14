// ============================================================
// CockpitStats — the KPI tile row beneath the hero. Cash / MTD revenue /
// MTD expense / Net profit, each with its own accent and icon chip.
// ============================================================

import { Wallet, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { formatINR } from "@/lib/utils";

interface CockpitStatsProps {
  cashPosition: number;
  mtdRevenue: number;
  mtdExpense: number;
  mtdNet: number;
}

export function CockpitStats({ cashPosition, mtdRevenue, mtdExpense, mtdNet }: CockpitStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Cash position"
        value={formatINR(cashPosition)}
        accent="emerald"
        icon={<Wallet className="size-4" />}
        sub="Bank ledger balance"
      />
      <StatTile
        label="Revenue · MTD"
        value={formatINR(mtdRevenue)}
        accent="blue"
        icon={<TrendingUp className="size-4" />}
        sub="Income posted this period"
      />
      <StatTile
        label="Expense · MTD"
        value={formatINR(mtdExpense)}
        accent="amber"
        icon={<TrendingDown className="size-4" />}
        sub="Spend posted this period"
      />
      <StatTile
        label="Net profit · MTD"
        value={formatINR(mtdNet)}
        accent="violet"
        icon={<PiggyBank className="size-4" />}
        sub={mtdNet >= 0 ? "In the black this month" : "Running at a loss"}
      />
    </div>
  );
}
