import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listPolicies } from "@/actions/hr-attendance-policy.actions";
import { PolicyAdmin } from "./_components/policy-admin";

export const metadata: Metadata = { title: "Attendance Policies" };

export default async function AttendancePolicyPage() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:admin")) redirect("/people");

  const policies = await listPolicies();

  return (
    <div className="space-y-5">
      <Link
        href="/people/attendance"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to attendance
      </Link>
      <PageHeader
        icon={CalendarClock}
        accent="amber"
        title="Attendance Policies"
        description="Define grace periods, half/full-day thresholds, weekly-offs, late-mark-to-LOP rules and overtime settings. One policy is the organisation default."
      />

      <p className="rounded-lg border border-dashed bg-muted/30 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
        Policy application into the LOP/attendance calculation is wired separately.
      </p>

      <PolicyAdmin policies={policies} />
    </div>
  );
}
