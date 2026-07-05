import type { Metadata } from "next";
import Link from "next/link";
import {
  PlusIcon,
  IndianRupeeIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";

import { getBudgets } from "@/actions/forecast.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import { BudgetTable } from "./_components/budget-table";
import { BudgetYearFilter } from "./_components/budget-year-filter";

export const metadata: Metadata = { title: "Budgets" };

// ============================================================
// Budget Management Page
// ============================================================

interface BudgetPageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function BudgetPage({ searchParams }: BudgetPageProps) {
  const params = await searchParams;
  const yearFilter = params.year ? parseInt(params.year, 10) : undefined;

  const result = await getBudgets(yearFilter ? { year: yearFilter } : undefined);
  const budgets = result.success ? result.data : [];

  // Calculate stats for selected year
  const totalRevenue = budgets.reduce(
    (sum: number, b: { revenue: number }) => sum + b.revenue,
    0
  );
  const totalExpenses = budgets.reduce(
    (sum: number, b: { expenses: number }) => sum + b.expenses,
    0
  );
  const totalProfit = budgets.reduce(
    (sum: number, b: { profit: number }) => sum + b.profit,
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Analytics · Budgets"
        title="Budgets"
        help={<PageHelp id="budget" />}
        description="Manage budget entries and track financial performance."
      >
        <div className="flex items-center gap-2">
          <BudgetYearFilter />
          <Button asChild>
            <Link href="/analytics/budget/new">
              <PlusIcon className="mr-2 size-4" />
              Add Budget
            </Link>
          </Button>
        </div>
      </PageHeader>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Total Budgeted Revenue"
          value={formatINR(totalRevenue)}
          accent="emerald"
          icon={<IndianRupeeIcon className="size-4" />}
          sub={`${budgets.length} budget${budgets.length !== 1 ? "s" : ""} ${yearFilter ? `in ${yearFilter}` : "total"}`}
        />
        <StatTile
          label="Total Budgeted Expenses"
          value={formatINR(totalExpenses)}
          accent="rose"
          icon={<TrendingDownIcon className="size-4" />}
          sub="Across all budget entries"
        />
        <StatTile
          label="Total Budgeted Profit"
          value={formatINR(totalProfit)}
          accent={totalProfit >= 0 ? "indigo" : "rose"}
          icon={<TrendingUpIcon className="size-4" />}
          sub="Revenue minus expenses"
        />
      </div>

      {/* Budget Table */}
      <BudgetTable data={budgets} />
    </div>
  );
}
