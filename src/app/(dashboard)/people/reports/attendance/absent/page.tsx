import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { UserX } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getAbsentReport } from "@/actions/hr-report-attendance.actions";
import { defaultRange } from "../_lib/range";
import { AbsentView } from "./_components/absent-view";

export const metadata: Metadata = { title: "Attendance · Absent report" };

export default async function AbsentPage() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");

  const { from, to } = defaultRange();
  const initial = await getAbsentReport({ from, to });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserX}
        accent="amber"
        eyebrow="Time office · Reports"
        title="Absent report"
        description="Employees marked ABSENT across a date range, with regularisation status and any note."
      />
      <AbsentView initialFrom={from} initialTo={to} initial={initial} />
    </div>
  );
}
