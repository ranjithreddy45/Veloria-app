import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { ComingSoon } from "../_components/coming-soon";

export const metadata: Metadata = { title: "Timesheets" };

export default async function Page() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) notFound();
  return (
    <ComingSoon
      title="Timesheets"
      description="Log billable and project hours against bookings and projects."
      bullets={["Per-project / per-booking time entries", "Weekly timesheet submit + approve", "Feeds utilisation into HR Analytics"]}
    />
  );
}
