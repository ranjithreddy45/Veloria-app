import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Receipt, ArrowRight, FileSpreadsheet, ListTree, Landmark, Building2, Sigma,
} from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { listSalaryRuns } from "@/actions/hr-report-salary.actions";

export const metadata: Metadata = { title: "Salary Reports" };

const REPORTS = [
  {
    href: "/people/reports/salary/sheet",
    title: "Salary sheet",
    desc: "Standard one-row-per-employee sheet: paid days, gross, PF/ESI/PT/TDS, net.",
    icon: FileSpreadsheet,
  },
  {
    href: "/people/reports/salary/detailed",
    title: "Salary sheet (detailed)",
    desc: "Every earning and deduction component expanded into its own column.",
    icon: ListTree,
  },
  {
    href: "/people/reports/salary/bank",
    title: "Bank statement / advice",
    desc: "Bank A/C, IFSC and net for disbursement. Excludes on-hold salaries.",
    icon: Landmark,
  },
  {
    href: "/people/reports/salary/ctc",
    title: "CTC sheet",
    desc: "Gross plus employer PF (EPS/EPF), ESI, EDLI, admin, gratuity accrual and CTC.",
    icon: Building2,
  },
  {
    href: "/people/reports/salary/summary",
    title: "Salary summary",
    desc: "Run totals: headcount, gross, PF/ESI (ee+er), TDS, net, employer cost, CTC.",
    icon: Sigma,
  },
];

export default async function SalaryReportsIndexPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const runs = await listSalaryRuns();
  const finalRuns = runs.filter((r) => r.isFinal);
  const latest = finalRuns[0] ?? runs[0];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        accent="emerald"
        eyebrow="Payroll"
        title="Salary Reports"
        description="Read-only reporting over locked and paid payroll runs — salary sheets, bank advice, CTC and summary. Export to CSV or print."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Payroll runs" value={runs.length} accent="indigo" icon={<Receipt />} />
        <StatTile label="Final runs" value={finalRuns.length} accent="emerald" icon={<FileSpreadsheet />} sub="Locked or paid" />
        <StatTile label="Latest period" value={latest?.label ?? "—"} accent="gold" icon={<Sigma />} sub={latest ? `${latest.headcount} employees` : "No runs yet"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.href}
              href={r.href}
              className="group flex items-start gap-3.5 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
            >
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.title}</span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{r.desc}</p>
              </div>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
