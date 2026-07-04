import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getMyTimesheet, getPendingApprovals } from "@/actions/timesheet.actions";
import { TimesheetGrid } from "./_components/timesheet-grid";

export const metadata: Metadata = { title: "Timesheets" };

function thisMondayISO(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60_000);
  const dow = ist.getUTCDay();
  const diff = (dow + 6) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - diff))
    .toISOString()
    .slice(0, 10);
}

export default async function Page() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) notFound();

  const canApprove =
    role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role, "hr:approve") || hasPermission(role, "hr:admin");

  const [initial, initialApprovals] = await Promise.all([
    getMyTimesheet(thisMondayISO()),
    canApprove ? getPendingApprovals() : Promise.resolve([]),
  ]);

  if (!initial) notFound();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Timesheets"
        eyebrow="People"
        description="Log your weekly hours against projects, then submit for approval."
      />
      <TimesheetGrid initial={initial} initialApprovals={initialApprovals} canApprove={canApprove} />
    </div>
  );
}
