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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Budgeted Revenue
            </CardTitle>
            <IndianRupeeIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatINR(totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {budgets.length} budget{budgets.length !== 1 ? "s" : ""}{" "}
              {yearFilter ? `in ${yearFilter}` : "total"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Budgeted Expenses
            </CardTitle>
            <TrendingDownIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {formatINR(totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all budget entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Budgeted Profit
            </CardTitle>
            <TrendingUpIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                totalProfit >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {formatINR(totalProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue minus expenses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Table */}
      <BudgetTable data={budgets} />
    </div>
  );
}
