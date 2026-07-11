import type { Metadata } from "next";
import Link from "next/link";
import {
  Users, IdCard, Cake, CalendarPlus, CalendarX, Network, PieChart, ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { guardEmployeeReports } from "./_components/guard";

export const metadata: Metadata = { title: "Employee Reports" };

const REPORTS: {
  href: string;
  title: string;
  description: string;
  icon: typeof IdCard;
  accent: string;
}[] = [
  {
    href: "/people/reports/employee/master",
    title: "Employee master",
    description: "Full directory export — code, name, gender, DOJ, department, designation, branch and contact.",
    icon: IdCard,
    accent: "text-violet-600 bg-violet-500/10 dark:text-violet-300",
  },
  {
    href: "/people/reports/employee/dob",
    title: "Date of Birth",
    description: "Upcoming birthdays in the next 30 / 60 / 90 days, sorted by how soon they fall.",
    icon: Cake,
    accent: "text-pink-600 bg-pink-500/10 dark:text-pink-300",
  },
  {
    href: "/people/reports/employee/doj",
    title: "Date of Joining",
    description: "Joiners with tenure, filterable by a joining-date range.",
    icon: CalendarPlus,
    accent: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300",
  },
  {
    href: "/people/reports/employee/exits",
    title: "Date of Leaving",
    description: "Exited employees with exit date and tenure at exit, filterable by exit-date range.",
    icon: CalendarX,
    accent: "text-rose-600 bg-rose-500/10 dark:text-rose-300",
  },
  {
    href: "/people/reports/employee/reporting",
    title: "Reporting Authority",
    description: "Every employee mapped to their reporting manager across the org.",
    icon: Network,
    accent: "text-blue-600 bg-blue-500/10 dark:text-blue-300",
  },
  {
    href: "/people/reports/employee/classification",
    title: "Classification",
    description: "Headcount pivoted by department, designation, branch and status.",
    icon: PieChart,
    accent: "text-amber-600 bg-amber-500/10 dark:text-amber-300",
  },
];

export default async function EmployeeReportsIndex() {
  await guardEmployeeReports();

  return (
    <div className="space-y-5">
      <PageHeader
        aura
        icon={Users}
        accent="violet"
        eyebrow="People · Reports"
        title="Employee Reports"
        description="Read-only reports over the employee master. Filter, review and export any slice of the workforce to CSV."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="group">
            <Card className="h-full p-5 transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] hover:-translate-y-1 hover:shadow-card-hover">
              <div className="flex items-start gap-3.5">
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl [&>svg]:size-[22px]", r.accent)}>
                  <r.icon strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold tracking-[-0.01em]">{r.title}</h3>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{r.description}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
