import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getAllotmentReport, getReportYears } from "@/actions/hr-report-leave.actions";
import { LeaveReportNav } from "../_components/leave-report-nav";
import { YearSelect } from "../_components/year-select";
import { AllotmentView } from "../_components/allotment-view";

export const metadata: Metadata = { title: "Leave Allotment Report" };

export default async function LeaveAllotmentReportPage({
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

  const rows = await getAllotmentReport(year);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="People · Reports"
          icon={CalendarCheck}
          accent="blue"
          title="Leave Allotment Report"
          description="Leave granted for the year — entitlement plus any carry-forward, per employee and leave type."
        />
        <YearSelect years={years} value={year} />
      </div>
      <LeaveReportNav />
      <AllotmentView rows={rows} year={year} />
    </div>
  );
}
