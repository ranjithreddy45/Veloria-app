import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listSalaryRuns, getSalarySheetDetailed } from "@/actions/hr-report-salary.actions";
import { SalaryDetailedView } from "./_components/salary-detailed-view";

export const metadata: Metadata = { title: "Salary Sheet (Detailed)" };

export default async function SalaryDetailedPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const periods = await listSalaryRuns();
  const initialPeriod = periods.find((p) => p.isFinal) ?? periods[0] ?? null;
  const initial = initialPeriod
    ? await getSalarySheetDetailed({ fy: initialPeriod.fy, month: initialPeriod.month })
    : null;

  return (
    <div className="space-y-5">
      <Link href="/people/reports/salary" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Salary reports
      </Link>
      <PageHeader
        eyebrow="Payroll"
        title="Salary Sheet (Detailed)"
        description="Every earning and deduction component expanded into its own column, one row per employee."
      />
      <SalaryDetailedView periods={periods} initial={initial} initialKey={initialPeriod ? `${initialPeriod.fy}|${initialPeriod.month}` : ""} />
    </div>
  );
}
