import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getVenuesForBudget } from "@/actions/forecast.actions";
import { BudgetForm } from "../_components/budget-form";

export const metadata: Metadata = { title: "New Budget" };

// ============================================================
// Create Budget Page
// ============================================================

export default async function NewBudgetPage() {
  const venuesResult = await getVenuesForBudget();
  const venues = venuesResult.success ? venuesResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Budget"
        description="Create a new budget entry for financial tracking."
      />
      <div className="mx-auto max-w-3xl">
        <BudgetForm venues={venues} />
      </div>
    </div>
  );
}
