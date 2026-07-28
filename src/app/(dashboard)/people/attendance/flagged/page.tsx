import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getFlaggedPunches } from "@/actions/hr-attendance.actions";
import { FlaggedQueue } from "./_components/flagged-queue";

export const metadata: Metadata = { title: "Flagged check-ins" };

export default async function FlaggedCheckinsPage() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");

  // Clearing a flag is an HR-privileged action; read-only users see the queue
  // but can't resolve anything.
  const canClear = hasPermission(role, "hr:write") || hasPermission(role, "hr:admin");

  const punches = await getFlaggedPunches();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlert}
        accent="amber"
        eyebrow="Attendance"
        title="Flagged check-ins"
        description="Punches the system couldn't fully verify — unverified location, low GPS accuracy, or an off-site check-in. Review each and clear the flag once you're satisfied."
      />
      <FlaggedQueue punches={punches} canClear={canClear} />
    </div>
  );
}
