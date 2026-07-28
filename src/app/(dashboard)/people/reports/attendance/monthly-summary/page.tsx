import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getMonthlySummary } from "@/actions/hr-report-attendance.actions";
import { MonthlySummaryView } from "./_components/monthly-summary-view";

export const metadata: Metadata = { title: "Attendance · Monthly summary" };

function currentFyMonth(): { fy: string; month: number } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const startYear = m >= 4 ? y : y - 1;
  return { fy: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`, month: m };
}

export default async function MonthlySummaryPage() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");

  const { fy, month } = currentFyMonth();
  const initial = await getMonthlySummary({ fy, month });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarCheck}
        accent="amber"
        eyebrow="Time office · Reports"
        title="Monthly attendance summary"
        description="For a chosen month, every active employee's attendance tallied by status — present, absent, half-days, WFH, leave, holidays and week-offs — with total worked hours."
      />
      <MonthlySummaryView initialFy={fy} initialMonth={month} initial={initial} />
    </div>
  );
}
