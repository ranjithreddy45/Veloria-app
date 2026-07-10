import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getDailyMuster } from "@/actions/hr-attendance-register.actions";
import { MusterView } from "./_components/muster-view";

export const metadata: Metadata = { title: "Attendance Muster" };

/** Today's IST calendar day as YYYY-MM-DD (records are UTC-midnight @db.Date). */
function todayIst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Indian FY containing the current calendar month (FY starts April). */
function currentFy(): string {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() + 1 >= 4
    ? `${y}-${String((y + 1) % 100).padStart(2, "0")}`
    : `${y - 1}-${String(y % 100).padStart(2, "0")}`;
}

export default async function AttendanceMusterPage() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");

  // Correcting the muster is an HR-privileged action; read-only users still see
  // the register but the grid stays static for them.
  const canEdit = hasPermission(role, "hr:write") || hasPermission(role, "hr:admin");

  const date = todayIst();
  const initial = await getDailyMuster({ date });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Attendance"
        title="Muster / Register"
        description="The organisation-wide attendance register. Pick a day to see who's present, absent, on leave or working from home — with check-in time and any flagged punches — or switch to the monthly grid."
      />
      <MusterView initialDate={date} initial={initial} initialFy={currentFy()} initialMonth={new Date().getMonth() + 1} canEdit={canEdit} />
    </div>
  );
}
