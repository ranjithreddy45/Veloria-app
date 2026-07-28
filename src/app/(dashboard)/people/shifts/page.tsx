import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getRoster, getMyShifts, getSwapQueue } from "@/actions/hr-shifts.actions";
import { getHrLookups } from "@/actions/hr-employee.actions";
import { ShiftsHome } from "./_components/shifts-home";

export const metadata: Metadata = { title: "Shifts" };

// Monday of the week containing `d` (UTC).
function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay(); // 0 Sun..6 Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

interface PageProps { searchParams: Promise<{ week?: string }> }

export default async function ShiftsPage({ searchParams }: PageProps) {
  if (!FEATURES.hr || !FEATURES.hrShifts) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");
  const canWrite = hasPermission(role, "hr:write");
  const canAdmin = hasPermission(role, "hr:admin");

  const sp = await searchParams;
  const base = sp.week ? new Date(sp.week + "T00:00:00.000Z") : new Date();
  const monday = mondayOf(base);
  const weekStart = monday.toISOString().slice(0, 10);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10);
  });

  const [roster, mine, swaps, lookups] = await Promise.all([
    getRoster(weekStart), getMyShifts(), getSwapQueue(), getHrLookups(),
  ]);
  const myShifts = mine && mine.linked !== false ? mine.upcoming : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts"
        description="Roster your team across the week, let staff swap shifts with approval, and keep everyone clear on when they’re working — essential for hotels and event crews."
      />
      <ShiftsHome
        weekStart={weekStart}
        weekDays={weekDays}
        employees={roster.employees as never}
        assignments={roster.assignments as never}
        shifts={roster.shifts as never}
        myShifts={myShifts as never}
        colleagues={lookups.managers as never}
        swaps={swaps.rows as never}
        canWrite={canWrite}
        canAdmin={canAdmin}
      />
    </div>
  );
}
