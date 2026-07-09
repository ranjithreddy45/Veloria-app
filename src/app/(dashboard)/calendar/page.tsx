import type { Metadata } from "next";
import { startOfMonth, endOfMonth } from "date-fns";

import { getMyCalendarTasks } from "@/actions/crm-task.actions";
import { PageHeader } from "@/components/layout/page-header";
import { MyCalendar } from "./_components/my-calendar";

export const metadata: Metadata = { title: "My Calendar" };

// ============================================================
// My Calendar — the current user's scheduled CRM tasks
// (follow-ups, calls, meetings, show-arounds) as a monthly agenda.
// Server component does the initial fetch; a small client component
// handles month navigation (via ?month=&year=) and "mark done".
// ============================================================

function clampMonth(v: number, fallback: number): number {
  return Number.isInteger(v) && v >= 1 && v <= 12 ? v : fallback;
}

export default async function MyCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const month = clampMonth(Number(sp.month), now.getMonth() + 1);
  const yearRaw = Number(sp.year);
  const year = Number.isInteger(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : now.getFullYear();

  const anchor = new Date(year, month - 1, 1);
  const from = startOfMonth(anchor);
  const to = endOfMonth(anchor);

  const result = await getMyCalendarTasks(from.toISOString(), to.toISOString());
  const tasks = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Sales CRM · Personal"
        title="My Calendar"
        description="Your scheduled follow-ups, calls, meetings and show-arounds. Overdue items are flagged in red — mark them done as you go."
      />
      <MyCalendar tasks={tasks} month={month} year={year} />
    </div>
  );
}
