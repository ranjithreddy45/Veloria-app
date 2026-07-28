import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FileBarChart } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getGratuityLedger } from "@/actions/hr-gratuity.actions";
import { GratuityNav } from "../_components/gratuity-nav";
import { GratuityReportView } from "./_components/report-view";

export const metadata: Metadata = { title: "Gratuity Report" };

export default async function GratuityReportPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  // Self-guard: accrual vs payout is compensation data → hr:payroll.
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const rows = await getGratuityLedger();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll"
        icon={FileBarChart}
        accent="blue"
        title="Gratuity Report"
        description="Accrued (already booked as cost across payslips) vs. projected payable (what would be owed today). The difference per employee surfaces any under- or over-accrual."
      />
      <GratuityNav />
      <GratuityReportView rows={rows} />
    </div>
  );
}
