import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getRegularizationQueue } from "@/actions/hr-attendance.actions";
import { RegnQueue } from "./_components/regn-queue";

export const metadata: Metadata = { title: "Regularizations" };

export default async function RegularizationsPage() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) redirect("/people");

  const { rows } = await getRegularizationQueue();

  return (
    <div className="space-y-5">
      <Link href="/people/attendance" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to attendance
      </Link>
      <PageHeader
        title="Attendance regularizations"
        description="Corrections requested by your team. Approving applies the corrected status to that day’s record."
      />
      <RegnQueue rows={rows as never} />
    </div>
  );
}
