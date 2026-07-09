import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { getPayrollRun } from "@/actions/hr-payroll-run.actions";
import { RunDetail, type RunView } from "./_components/run-detail";

export const metadata: Metadata = { title: "Payroll run" };

export default async function PayrollRunPage({ params }: { params: Promise<{ runId: string }> }) {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const { runId } = await params;
  const run = await getPayrollRun(runId);
  if (!run) notFound();

  const view: RunView = {
    id: run.id,
    fy: run.fy,
    label: run.label,
    status: run.status,
    headcount: run.headcount,
    totalGross: Number(run.totalGross),
    totalDeductions: Number(run.totalDeductions),
    totalNet: Number(run.totalNet),
    lockedAt: run.lockedAt ? run.lockedAt.toISOString() : null,
    payslips: run.payslips.map((p) => ({
      id: p.id,
      employeeId: p.employeeId,
      empCode: p.empCodeSnap,
      name: p.nameSnap,
      paidDays: Number(p.paidDays),
      gross: Number(p.gross),
      pf: Number(p.pf),
      esi: Number(p.esi),
      pt: Number(p.pt),
      tds: Number(p.tds),
      net: Number(p.net),
    })),
  };

  return (
    <div className="space-y-5">
      <Link href="/people/payroll" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to payroll
      </Link>
      <RunDetail run={view} />
    </div>
  );
}
