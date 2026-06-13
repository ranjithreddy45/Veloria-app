import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getProfitAndLoss, getBalanceSheet, getTrialBalance, getFinFiscalYears } from "@/actions/finance.actions";
import { FinanceReports } from "../_components/finance-reports";

export const metadata = { title: "Finance Reports · Veloria Grand" };

export default async function FinanceReportsPage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");

  const { fy: fyParam } = await searchParams;
  const fiscalYears = await getFinFiscalYears();
  const fy = fyParam && fiscalYears.includes(fyParam) ? fyParam : (fiscalYears[0] ?? "");

  const [pl, bs, tb] = await Promise.all([
    getProfitAndLoss(fy || undefined),
    getBalanceSheet(),
    getTrialBalance(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financial reports</h1>
        <p className="text-sm text-muted-foreground">Profit &amp; Loss, Balance Sheet and Trial Balance — derived live from the posted ledger.</p>
      </div>
      <FinanceReports fy={fy} fiscalYears={fiscalYears} pl={pl} bs={bs} tb={tb} />
    </div>
  );
}
