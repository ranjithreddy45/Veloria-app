import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBudgetById, getVenuesForBudget } from "@/actions/forecast.actions";
import { PageHeader } from "@/components/layout/page-header";
import { BudgetForm } from "../../_components/budget-form";

export const metadata: Metadata = { title: "Edit Budget" };

// ============================================================
// Edit Budget Page
// ============================================================

interface EditBudgetPageProps {
  params: Promise<{ budgetId: string }>;
}

export default async function EditBudgetPage({
  params,
}: EditBudgetPageProps) {
  const { budgetId } = await params;

  const [budgetResult, venuesResult] = await Promise.all([
    getBudgetById(budgetId),
    getVenuesForBudget(),
  ]);

  if (!budgetResult.success || !budgetResult.data) {
    notFound();
  }

  const budget = budgetResult.data;
  const venues = venuesResult.success ? venuesResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Budget"
        description={`Editing ${budget.name}`}
      />
      <div className="mx-auto max-w-3xl">
        <BudgetForm budget={budget} venues={venues} />
      </div>
    </div>
  );
}
