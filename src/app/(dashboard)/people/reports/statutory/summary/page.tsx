import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listStatutoryPeriods, getStatutorySummary } from "@/actions/hr-report-statutory.actions";
import { NotFiledBanner } from "../_components/statutory-shared";
import { StatutorySummaryView } from "./summary-view";

export const metadata: Metadata = { title: "Statutory Summary" };

export default async function StatutorySummaryPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const periods = await listStatutoryPeriods();
  const first = periods[0];
  const initial = first ? await getStatutorySummary({ fy: first.fy, month: first.month }) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People · Reports"
        title="Statutory summary"
        description="One row per statute with the run total — a reconciliation view, not a filed return."
        accent="emerald"
      />
      <NotFiledBanner />
      <StatutorySummaryView periods={periods} initial={initial} />
    </div>
  );
}
