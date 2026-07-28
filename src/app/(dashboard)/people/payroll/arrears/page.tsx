import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Layers, Clock, BadgeIndianRupee, CheckCircle2 } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { listArrears, listArrearEmployees } from "@/actions/hr-arrear.actions";
import { NewArrearButton } from "./_components/new-arrear-button";
import { ArrearsTable } from "./_components/arrears-table";

export const metadata: Metadata = { title: "Salary arrears" };

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

/** Current Indian financial year label (FY starts April), e.g. "2026-27". */
function currentFy(): string {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() + 1 >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export default async function ArrearsPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:payroll")) redirect("/people");

  const [arrears, employees] = await Promise.all([
    listArrears(),
    listArrearEmployees(),
  ]);

  const thisFy = currentFy();
  const pending = arrears.filter((a) => a.status === "PENDING");
  const paidThisFy = arrears.filter((a) => a.status === "PAID" && a.payFy === thisFy);
  const pendingTotal = pending.reduce((s, a) => s + a.amount, 0);
  const paidTotal = paidThisFy.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary arrears"
        description="One-off amounts owed to employees — back-dated hikes, missed components, corrections — paid through a chosen payroll run. Statutory deductions are applied by the run when it pays the arrear."
        icon={Layers}
        accent="amber"
      >
        <NewArrearButton employees={employees} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Pending arrears"
          value={pending.length}
          accent="amber"
          icon={<Clock />}
          sub="Awaiting a payroll run"
        />
        <StatTile
          label="Pending amount"
          value={inr(pendingTotal)}
          accent="rose"
          icon={<BadgeIndianRupee />}
          sub="Total owed, not yet paid"
        />
        <StatTile
          label="Paid arrears"
          value={paidThisFy.length}
          accent="emerald"
          icon={<CheckCircle2 />}
          sub={`Paid this FY ${thisFy}`}
        />
        <StatTile
          label="Paid amount"
          value={inr(paidTotal)}
          accent="teal"
          icon={<BadgeIndianRupee />}
          sub={`Through runs, FY ${thisFy}`}
        />
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-700 dark:text-amber-300">
        A pending arrear is paid — with its statutory deductions — the next time you process payroll
        for its pay month. Once paid it is locked and can no longer be edited or cancelled here.
      </div>

      <ArrearsTable rows={arrears} employees={employees} />
    </div>
  );
}
