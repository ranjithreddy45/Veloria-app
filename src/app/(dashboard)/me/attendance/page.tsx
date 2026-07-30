import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, LogIn, UserX } from "lucide-react";
import { auth } from "@/../auth";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getMyAttendance } from "@/actions/hr-attendance.actions";
import { AttendanceHome } from "@/app/(dashboard)/people/attendance/_components/attendance-home";
import { MyMonthCalendar, type MyAttendanceDay } from "./_components/my-month-calendar";

export const metadata: Metadata = { title: "My Attendance" };

// ============================================================
// Employee self-service — "My Attendance".
// ------------------------------------------------------------
// Lives OUTSIDE the hr:read-gated /people tree so an ordinary employee (STAFF,
// who holds no hr:* permission) can reach their own attendance. Safe because
// every action used here is self-scoped: getMyAttendance() resolves the signed-in
// user → their own Employee row and returns only that employee's records.
// Admin surfaces (muster, sites, regularizations) stay under /people and keep
// their own server-side permission guards.
// ============================================================

export default async function MyAttendancePage() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  if (!session?.user?.id) notFound();

  const data = await getMyAttendance();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Clock}
        accent="gold"
        eyebrow="My space"
        title="My Attendance"
        description="Check in and out with location verification, track your hours, and request corrections."
      />

      {!data ? (
        <div className="rounded-2xl border border-dashed bg-card">
          <EmptyState
            icon={<LogIn className="size-5" />}
            title="Please sign in"
            description="Your attendance is private to you, so we need an active session before it can be shown."
          />
        </div>
      ) : data.linked === false ? (
        <div className="rounded-2xl border border-dashed bg-card">
          <EmptyState
            icon={<UserX className="size-5" />}
            title="No employee profile linked"
            description="Your login isn’t connected to an employee record yet, so attendance can’t be tracked. Ask HR to link your profile."
          />
        </div>
      ) : (
        <>
          {/* Additive month calendar — sits above the punch-in/out list. */}
          <MyMonthCalendar
            initialYear={data.year}
            initialMonth={data.month}
            initialRecords={data.records.map(
              (r): MyAttendanceDay => ({
                date: r.date.toISOString(),
                status: r.status,
                checkInAt: r.checkInAt ? r.checkInAt.toISOString() : null,
                checkOutAt: r.checkOutAt ? r.checkOutAt.toISOString() : null,
                workedMinutes: r.workedMinutes,
                // Geo-tag: siteId is a plain String → resolve via the sites map.
                siteName: r.siteId ? data.sites[r.siteId] ?? null : null,
                locationVerified: r.locationVerified,
                lat: r.checkInLat,
                lng: r.checkInLng,
                visitType: r.visitType,
              }),
            )}
          />

          {/* Self-service only: never expose the HR manual-mark override here. */}
          <AttendanceHome
            today={data.today as never}
            records={data.records as never}
            stats={data.stats}
            canMarkManually={false}
            employees={[]}
          />
        </>
      )}
    </div>
  );
}
