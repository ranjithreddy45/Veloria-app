import { redirect } from "next/navigation";
import Link from "next/link";
import { FileBarChart2Icon, FileDownIcon } from "lucide-react";
import { auth } from "@/../auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { hasPermission } from "@/lib/permissions";
import { getProfitAndLoss, getBalanceSheet, getTrialBalance, getFinFiscalYears } from "@/actions/finance.actions";
import { FinanceReports } from "../_components/finance-reports";
import { InvestorPackButton } from "../_components/investor-pack-button";

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
    <div className="space-y-6">
      <PageHeader
        icon={FileBarChart2Icon}
        accent="gold"
        eyebrow={fy ? <span className="numeric">FY {fy}</span> : "Finance"}
        title="Financial reports"
        description="Profit & Loss, Balance Sheet and Trial Balance — derived live from the posted ledger."
      >
        <Button asChild variant="outline">
          <Link href="/finance/reports/tally"><FileDownIcon className="mr-2 h-4 w-4" />Tally export</Link>
        </Button>
        <InvestorPackButton fy={fy} />
      </PageHeader>
      <FinanceReports fy={fy} fiscalYears={fiscalYears} pl={pl} bs={bs} tb={tb} />
    </div>
  );
}
