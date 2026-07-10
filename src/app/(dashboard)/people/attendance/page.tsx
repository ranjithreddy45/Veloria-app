import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, MapPin, ShieldAlert } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getMyAttendance, getAttendanceEmployees } from "@/actions/hr-attendance.actions";
import { AttendanceHome } from "./_components/attendance-home";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  const canApprove = hasPermission(role, "hr:approve");
  const canReadHr = hasPermission(role, "hr:read");
  const canAdmin = hasPermission(role, "hr:admin");
  const canMarkManually = hasPermission(role, "hr:write") || canAdmin;

  const [data, employees] = await Promise.all([
    getMyAttendance(),
    canMarkManually ? getAttendanceEmployees() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Attendance"
          description="Check in and out with location verification, track your hours, and request corrections. Office and multi-site rules are enforced automatically."
        />
        <div className="flex items-center gap-2">
          {canReadHr && (
            <Button variant="outline" asChild className="gap-1.5">
              <Link href="/people/attendance/flagged"><ShieldAlert className="size-4" /> Flagged</Link>
            </Button>
          )}
          {canApprove && (
            <Button variant="outline" asChild className="gap-1.5">
              <Link href="/people/attendance/regularizations"><ClipboardCheck className="size-4" /> Regularizations</Link>
            </Button>
          )}
          {canAdmin && (
            <Button variant="outline" asChild className="gap-1.5">
              <Link href="/people/attendance/sites"><MapPin className="size-4" /> Sites</Link>
            </Button>
          )}
        </div>
      </div>

      {!data ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Please sign in.</div>
      ) : data.linked === false ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Your account isn’t linked to an employee record yet, so attendance can’t be tracked.
          {canApprove && " You can still review regularizations."}
        </div>
      ) : (
        <AttendanceHome today={data.today as never} records={data.records as never} stats={data.stats} canMarkManually={canMarkManually} employees={employees} />
      )}
    </div>
  );
}
