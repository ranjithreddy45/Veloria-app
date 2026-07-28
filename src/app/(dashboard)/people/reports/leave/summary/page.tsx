import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getSummaryReport, getReportYears } from "@/actions/hr-report-leave.actions";
import { LeaveReportNav } from "../_components/leave-report-nav";
import { YearSelect } from "../_components/year-select";
import { SummaryView } from "../_components/summary-view";

export const metadata: Metadata = { title: "Leave Summary Report" };

export default async function LeaveSummaryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  if (!FEATURES.hr || !FEATURES.hrLeave) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) redirect("/people");

  const years = await getReportYears();
  const sp = await searchParams;
  const parsed = Number(sp.year);
  const year = Number.isInteger(parsed) && years.includes(parsed) ? parsed : years[0];

  const rows = await getSummaryReport(year);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="People · Reports"
          icon={CalendarCheck}
          accent="blue"
          title="Leave Summary"
          description="Organisation-wide totals per leave type — entitled, used, pending and utilisation %."
        />
        <YearSelect years={years} value={year} />
      </div>
      <LeaveReportNav />
      <SummaryView rows={rows} year={year} />
    </div>
  );
}
