import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getAvailedReport, getReportYears } from "@/actions/hr-report-leave.actions";
import { LeaveReportNav } from "../_components/leave-report-nav";
import { AvailedView } from "../_components/availed-view";

export const metadata: Metadata = { title: "Leave Availed Report" };

/** Accept only YYYY-MM-DD; otherwise fall back. */
function safeDate(v: string | undefined, fallback: string): string {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback;
}

export default async function LeaveAvailedReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  if (!FEATURES.hr || !FEATURES.hrLeave) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) redirect("/people");

  const years = await getReportYears();
  const defaultYear = years[0] ?? new Date().getUTCFullYear();
  const sp = await searchParams;
  const from = safeDate(sp.from, `${defaultYear}-01-01`);
  const to = safeDate(sp.to, `${defaultYear}-12-31`);

  // UTC-midnight bounds; end-of-day on `to` so a request starting that day is
  // included in the overlap test.
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;
  const rows = await getAvailedReport(fromIso, toIso);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People · Reports"
        icon={CalendarCheck}
        accent="blue"
        title="Leave Availed Report"
        description="Approved leave taken within a date range — dates are shown in UTC. Adjust the period below."
      />
      <LeaveReportNav />
      <AvailedView rows={rows} from={from} to={to} />
    </div>
  );
}
