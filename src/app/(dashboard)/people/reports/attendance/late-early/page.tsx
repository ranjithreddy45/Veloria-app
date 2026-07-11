import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Timer } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getLateEarly } from "@/actions/hr-report-attendance.actions";
import { defaultRange } from "../_lib/range";
import { LateEarlyView } from "./_components/late-early-view";

export const metadata: Metadata = { title: "Attendance · Late-in / Early-out" };

export default async function LateEarlyPage() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");

  const { from, to } = defaultRange();
  const initial = await getLateEarly({ from, to });

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Timer}
        accent="amber"
        eyebrow="Time office · Reports"
        title="Late-in / Early-out"
        description="Days where the first check-in was after the expected-in time, the check-out before expected-out, or the worked time fell short. A review aid — read the note on what 'late' is measured against."
      />
      <LateEarlyView initialFrom={from} initialTo={to} initial={initial} />
    </div>
  );
}
