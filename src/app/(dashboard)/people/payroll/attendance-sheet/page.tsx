import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getAttendanceSheet } from "@/actions/hr-attendance-sheet.actions";
import { AttendanceSheetView } from "./_components/attendance-sheet-view";

export const metadata: Metadata = { title: "Attendance Sheet" };

/** Indian FY containing the current calendar month (FY starts April). */
function currentFy(): string {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() + 1 >= 4
    ? `${y}-${String((y + 1) % 100).padStart(2, "0")}`
    : `${y - 1}-${String(y % 100).padStart(2, "0")}`;
}

export default async function AttendanceSheetPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const fy = currentFy();
  const month = new Date().getMonth() + 1;
  const initial = await getAttendanceSheet({ fy, month });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Payroll"
        title="Attendance Sheet"
        description="The monthly attendance report per employee — present days, approved paid leave and loss-of-pay. Generate, correct, then finalise. Finalised LOP days feed the salary sheet."
      />
      <AttendanceSheetView initialFy={fy} initialMonth={month} initial={initial} />
    </div>
  );
}
