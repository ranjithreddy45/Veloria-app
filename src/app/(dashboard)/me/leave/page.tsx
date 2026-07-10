import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { auth } from "@/../auth";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getMyLeaveDashboard, getLeaveTypes, getHolidays } from "@/actions/hr-leave.actions";
import { LeaveHome } from "@/app/(dashboard)/people/leave/_components/leave-home";

export const metadata: Metadata = { title: "My Leave" };

// ============================================================
// Employee self-service — "My Leave".
// ------------------------------------------------------------
// Outside the hr:read-gated /people tree so an ordinary employee can reach their
// own balances and requests. Self-scoped: getMyLeaveDashboard() resolves the
// signed-in user → their Employee row. Admin surfaces (approvals, holidays,
// team calendar) stay under /people with their own permission guards.
// ============================================================

export default async function MyLeavePage() {
  if (!FEATURES.hr || !FEATURES.hrLeave) notFound();
  const session = await auth();
  if (!session?.user?.id) notFound();

  const [dashboard, types, holidays] = await Promise.all([
    getMyLeaveDashboard(),
    getLeaveTypes(true),
    getHolidays(),
  ]);

  // Upcoming holidays only (today onwards), serialized for the client.
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const upcomingHolidays = holidays
    .filter((h) => new Date(h.date) >= startToday)
    .slice(0, 6)
    .map((h) => ({ id: h.id, name: h.name, date: new Date(h.date).toISOString() }));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CalendarCheck}
        accent="violet"
        eyebrow="My space"
        title="My Leave"
        description="Apply for time off, track your balances, and see where each request stands. Weekends and holidays are handled for you."
      />

      {types.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Leave hasn&rsquo;t been set up yet. Ask an HR Manager to configure leave types.
        </div>
      ) : !dashboard ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Please sign in.
        </div>
      ) : dashboard.linked === false ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Your account isn&rsquo;t linked to an employee record yet, so there&rsquo;s no leave balance to show. Ask HR
          to connect your profile.
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
