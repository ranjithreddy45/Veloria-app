import type { Metadata } from "next";
import { startOfMonth, endOfMonth } from "date-fns";
import { CalendarClockIcon } from "lucide-react";

import { getMyCalendarTasks } from "@/actions/crm-task.actions";
import { listAcqVisitsForCalendar } from "@/actions/acq-visit.actions";
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

  // BD site visits / meetings / calls appear alongside Sales CRM tasks, so an
  // employee has ONE calendar rather than having to remember which module a
  // commitment came from. listAcqVisitsForCalendar returns a DTO deliberately
  // shaped to match CalendarTaskDTO (with SITE_VISIT mapped to SHOW_AROUND etc.)
  // so the existing icon/colour table renders BD rows unchanged. Fetched in
  // parallel; either source failing degrades to the other rather than the page.
  const [result, bdVisits] = await Promise.all([
    getMyCalendarTasks(from.toISOString(), to.toISOString()),
    listAcqVisitsForCalendar({ from: from.toISOString(), to: to.toISOString() }),
  ]);
  const tasks = [
    ...(result.success ? result.data : []),
    ...(bdVisits.success ? bdVisits.data : []),
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        icon={CalendarClockIcon}
        accent="teal"
        eyebrow="Sales CRM · Personal"
        title="My Calendar"
        description="Your scheduled follow-ups, calls, meetings and show-arounds. Overdue items are flagged in red — mark them done as you go."
      />
      <MyCalendar tasks={tasks} month={month} year={year} />
    </div>
  );
}
