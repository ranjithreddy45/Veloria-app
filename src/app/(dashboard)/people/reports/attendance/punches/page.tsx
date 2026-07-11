import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getPunchReport } from "@/actions/hr-report-attendance.actions";
import { defaultRange } from "../_lib/range";
import { PunchesView } from "./_components/punches-view";

export const metadata: Metadata = { title: "Attendance · Punch report" };

export default async function PunchesPage() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");

  const { from, to } = defaultRange();
  const initial = await getPunchReport({ from, to });

  return (
    <div className="space-y-5">
      <PageHeader
        icon={MapPin}
        accent="amber"
        eyebrow="Time office · Reports"
        title="Punch report"
        description="Raw check-in / check-out punches — worked hours, matched site, verification status, visit type and a map link when GPS coordinates were captured. Times shown in IST."
      />
      <PunchesView initialFrom={from} initialTo={to} initial={initial} />
    </div>
  );
}
