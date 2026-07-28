import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listSalaryRuns, getSalarySummary } from "@/actions/hr-report-salary.actions";
import { SalarySummaryView } from "./_components/salary-summary-view";

export const metadata: Metadata = { title: "Salary Summary" };

export default async function SalarySummaryPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const periods = await listSalaryRuns();
  const initialPeriod = periods.find((p) => p.isFinal) ?? periods[0] ?? null;
  const initial = initialPeriod
    ? await getSalarySummary({ fy: initialPeriod.fy, month: initialPeriod.month })
    : null;

  return (
    <div className="space-y-6">
      <Link href="/people/reports/salary" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Salary reports
      </Link>
      <PageHeader
        eyebrow="Payroll"
        title="Salary Summary"
        description="Run totals at a glance — headcount, gross, statutory contributions (employee + employer), net, employer cost and CTC."
      />
      <SalarySummaryView periods={periods} initial={initial} initialKey={initialPeriod ? `${initialPeriod.fy}|${initialPeriod.month}` : ""} />
    </div>
  );
}
