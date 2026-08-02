import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getTeamLeave } from "@/actions/hr-leave.actions";
import { LeaveCalendar } from "./_components/leave-calendar";

export const metadata: Metadata = { title: "Leave Calendar" };

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function LeaveCalendarPage({ searchParams }: PageProps) {
  if (!FEATURES.hr || !FEATURES.hrLeave) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) redirect("/people");

  const sp = await searchParams;
  const now = new Date();
  const year = sp.year ? parseInt(sp.year, 10) : now.getUTCFullYear();
  const month = sp.month !== undefined ? parseInt(sp.month, 10) : now.getUTCMonth();

  const { holidays, leaves } = await getTeamLeave(year, month);

  return (
    <div className="space-y-6">
      <Link href="/people/leave" className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to leave
      </Link>
      <PageHeader
        title="Team leave calendar"
        description="See who’s off across the group at a glance — approved and pending leave plus public holidays, so you can spot clashes before approving."
      />
      <LeaveCalendar
        year={year}
        month={month}
        holidays={holidays as never}
        leaves={leaves as never}
      />
    </div>
  );
}
