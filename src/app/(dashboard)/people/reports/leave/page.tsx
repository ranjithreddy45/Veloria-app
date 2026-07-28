import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck, Wallet, Gift, TrendingDown, PieChart, ArrowRight } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { LeaveReportNav } from "./_components/leave-report-nav";

export const metadata: Metadata = { title: "Leave Reports" };

const REPORTS = [
  {
    href: "/people/reports/leave/balance",
    title: "Balance report",
    desc: "Entitled, carried-forward, used, pending and available per employee × leave type. Filter by type.",
    icon: Wallet,
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  {
    href: "/people/reports/leave/availed",
    title: "Availed report",
    desc: "Approved leave taken in a date range — employee, type, from–to, days and status.",
    icon: CalendarCheck,
    tint: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  },
  {
    href: "/people/reports/leave/allotment",
    title: "Allotment report",
    desc: "What was granted for the year — entitlement plus carry-forward per employee × type.",
    icon: Gift,
    tint: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  {
    href: "/people/reports/leave/lapsed",
    title: "Lapsed report",
    desc: "Projected days that would lapse at year-end above each type's carry-forward cap.",
    icon: TrendingDown,
    tint: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
  {
    href: "/people/reports/leave/summary",
    title: "Leave summary",
    desc: "Org-wide totals per leave type — entitled, used, pending and utilisation %.",
    icon: PieChart,
    tint: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
] as const;

export default async function LeaveReportsIndexPage() {
  if (!FEATURES.hr || !FEATURES.hrLeave) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) redirect("/people");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People · Reports"
        icon={CalendarCheck}
        accent="blue"
        title="Leave Reports"
        description="Read-only reporting over leave balances and requests. Pick a report — each has a year selector and CSV export."
      />
      <LeaveReportNav />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.href}
              href={r.href}
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 shadow-premium transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span className={`flex size-10 items-center justify-center rounded-xl ${r.tint} [&>svg]:size-5`}>
                <Icon />
              </span>
              <div>
                <div className="flex items-center gap-1 font-semibold tracking-[-0.01em] text-foreground">
                  {r.title}
                  <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{r.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
