import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getExceptions } from "@/actions/hr-report-attendance.actions";
import { defaultRange } from "../_lib/range";
import { ExceptionsView } from "./_components/exceptions-view";

export const metadata: Metadata = { title: "Attendance · Exceptions" };

export default async function ExceptionsPage() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");

  const { from, to } = defaultRange();
  const initial = await getExceptions({ from, to });

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ShieldAlert}
        accent="amber"
        eyebrow="Time office · Reports"
        title="Attendance exceptions"
        description="Geo-integrity exceptions — punches the system flagged, or whose location it could not verify. Review GPS accuracy, the matched site and verification status."
      />
      <ExceptionsView initialFrom={from} initialTo={to} initial={initial} />
    </div>
  );
}
