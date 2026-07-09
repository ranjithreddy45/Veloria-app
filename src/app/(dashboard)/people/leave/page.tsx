import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CalendarCheck2, CalendarClock } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getMyLeaveDashboard, getLeaveTypes, getHolidays } from "@/actions/hr-leave.actions";
import { LeaveHome } from "./_components/leave-home";
import { LeaveSetup } from "./_components/leave-setup";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage() {
  if (!FEATURES.hr || !FEATURES.hrLeave) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  const canApprove = hasPermission(role, "hr:approve");
  const canAdmin = hasPermission(role, "hr:admin");

  const [dashboard, types, holidays] = await Promise.all([
    getMyLeaveDashboard(),
    getLeaveTypes(true),
    getHolidays(),
  ]);
  const needsSetup = types.length === 0;

  // Upcoming holidays only (today onwards), serialized for the client.
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const upcomingHolidays = holidays
    .filter((h) => new Date(h.date) >= startToday)
    .slice(0, 6)
    .map((h) => ({ id: h.id, name: h.name, date: new Date(h.date).toISOString() }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Leave"
          description="Apply for time off, track your balances, and see where each request stands. Weekends and holidays are handled for you."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="gap-1.5">
            <Link href="/people/leave/calendar"><CalendarDays className="size-4" /> Team calendar</Link>
          </Button>
          {canApprove && (
            <Button variant="outline" asChild className="gap-1.5">
              <Link href="/people/leave/approvals"><CalendarCheck2 className="size-4" /> Approvals</Link>
            </Button>
          )}
          {canAdmin && (
            <Button variant="outline" asChild className="gap-1.5">
              <Link href="/people/leave/holidays"><CalendarClock className="size-4" /> Holidays</Link>
            </Button>
          )}
        </div>
      </div>

      {needsSetup ? (
        canAdmin ? <LeaveSetup /> : (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Leave hasn’t been set up yet. Ask an HR Manager to configure leave types.
          </div>
        )
      ) : !dashboard ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Please sign in.</div>
      ) : dashboard.linked === false ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Your account isn’t linked to an employee record yet, so there’s no leave balance to show.
          {canApprove && " You can still review team requests from Approvals."}
        </div>
      ) : (
        <LeaveHome
          balances={dashboard.balances as never}
          requests={dashboard.requests as never}
          types={types as never}
          holidays={upcomingHolidays}
        />
      )}
    </div>
  );
}
