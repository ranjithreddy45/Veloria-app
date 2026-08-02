import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Clock, CalendarCheck, ShieldAlert, Timer, UserX, MapPin, ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Attendance Reports" };

interface ReportCard {
  href: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  chip: string;
}

const REPORTS: ReportCard[] = [
  {
    href: "/people/reports/attendance/monthly-summary",
    title: "Monthly summary",
    desc: "Per-employee status tally for a month — present, absent, half-days, WFH, leave, holidays, week-offs and total worked hours.",
    icon: CalendarCheck,
    chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  },
  {
    href: "/people/reports/attendance/exceptions",
    title: "Exception report",
    desc: "Geo-integrity exceptions — flagged or unverified punches with GPS accuracy, site and verification status.",
    icon: ShieldAlert,
    chip: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  },
  {
    href: "/people/reports/attendance/late-early",
    title: "Late-in / Early-out",
    desc: "First check-in vs a configurable expected clock window, plus short-worked days. An eyeball aid, not a shift-graded verdict.",
    icon: Timer,
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  {
    href: "/people/reports/attendance/absent",
    title: "Absent report",
    desc: "Employees marked ABSENT across a date range, with regularisation status.",
    icon: UserX,
    chip: "bg-red-500/12 text-red-600 dark:text-red-300",
  },
  {
    href: "/people/reports/attendance/punches",
    title: "Punch report",
    desc: "Raw punches — in, out, worked hours, site, verification, visit type and a maps link when coordinates exist.",
    icon: MapPin,
    chip: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  },
];

export default async function AttendanceReportsIndex() {
  if (!FEATURES.hr || !FEATURES.hrAttendance) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Clock}
        accent="amber"
        eyebrow="Time office"
        title="Attendance reports"
        description="Read-only reports over the attendance register. Pick a report, choose a month or date range, review on screen and export to CSV. All clock times are shown in IST."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.href}
              href={r.href}
              className="group relative flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-premium transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span className={`flex size-11 items-center justify-center rounded-2xl [&>svg]:size-[22px] ${r.chip}`}>
                <Icon strokeWidth={2} />
              </span>
              <div>
                <h3 className="flex items-center gap-1.5 text-copy font-semibold">
                  {r.title}
                  <ArrowRight className="size-4 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                </h3>
                <p className="mt-1 text-detail leading-relaxed text-muted-foreground">{r.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
