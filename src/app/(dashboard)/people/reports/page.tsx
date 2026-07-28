import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Users, Receipt, Landmark, CalendarCheck, Clock, BarChart3 } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "HR Reports" };

// ============================================================
// HR Reports hub — links the read-only report groups. Each group self-guards on
// its own permission (employee/leave/attendance = hr:read; salary/statutory =
// hr:payroll), so a card may lead to a redirect for a viewer who lacks the
// deeper permission — that's intentional defence-in-depth, not a bug.
// ============================================================

const GROUPS = [
  { href: "/people/reports/employee", title: "Employee", desc: "Master, DOB, DOJ, exits, reporting authority, classification.", icon: Users, accent: "bg-violet-500/12 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300" },
  { href: "/people/reports/salary", title: "Salary", desc: "Salary sheets, bank statement, CTC sheet, summary.", icon: Receipt, accent: "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300" },
  { href: "/people/reports/statutory", title: "Statutory registers", desc: "PF / ESI / PT reconciliation registers (not filed returns).", icon: Landmark, accent: "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300" },
  { href: "/people/reports/leave", title: "Leave", desc: "Balance, availed, allotment, lapsed, summary.", icon: CalendarCheck, accent: "bg-blue-500/12 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300" },
  { href: "/people/reports/attendance", title: "Time office", desc: "Monthly summary, exceptions, absent, punch report.", icon: Clock, accent: "bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300" },
] as const;

export default async function HrReportsHubPage() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people");

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        accent="pink"
        eyebrow="People"
        title="HR Reports"
        description="Read-only registers and exports across employees, salary, statutory, leave and attendance."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((g) => {
          const Icon = g.icon;
          return (
            <Link key={g.href} href={g.href} className="group">
              <Card className="h-full gap-0 p-4 transition-[box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_24px_oklch(0_0_0/0.09)]">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span className={`flex size-9 items-center justify-center rounded-xl ${g.accent}`}>
                    <Icon className="size-4.5" strokeWidth={2} />
                  </span>
                  <span className="text-[14px] font-semibold">{g.title}</span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">{g.desc}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
