import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getTaxSummary, getTaxFiscalYears } from "@/actions/finance-tax.actions";
import { TaxWorkspace } from "../_components/tax-workspace";

export const metadata = { title: "Tax & Compliance · Veloria Grand" };

export default async function FinanceTaxPage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");

  const { fy: fyParam } = await searchParams;
  const fiscalYears = await getTaxFiscalYears();
  const fy = fyParam && fiscalYears.includes(fyParam) ? fyParam : (fiscalYears[0] ?? undefined);

  const summary = await getTaxSummary(fy);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        eyebrow="Finance · Tax & Compliance"
        title="GST & TDS"
        description="GSTR-3B, GSTR-1 outward supplies and TDS — derived live from the posted ledger. No figures are posted here."
      />
      <TaxWorkspace summary={summary} fiscalYears={fiscalYears} />
    </div>
  );
}
