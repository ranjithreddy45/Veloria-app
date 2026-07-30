import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Repeat, TrendingUp, TrendingDown } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { listRecurring, listRecurringEmployees } from "@/actions/hr-recurring.actions";
import { NewRecurringButton } from "./_components/new-recurring-button";
import { RecurringTable } from "./_components/recurring-table";

export const metadata: Metadata = { title: "Recurring pay" };

export default async function RecurringPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:payroll")) redirect("/people");

  const [rows, employees] = await Promise.all([
    listRecurring(),
    listRecurringEmployees(),
  ]);

  const activeEarnings = rows.filter((r) => r.active && r.kind === "EARNING").length;
  const activeDeductions = rows.filter((r) => r.active && r.kind === "DEDUCTION").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring pay"
        description="Standing per-employee earnings and deductions that repeat every payroll — allowances, fixed reimbursements, recurring recoveries. The payroll run applies each active component within its start/end window."
        icon={Repeat}
        accent="gold"
      >
        <NewRecurringButton employees={employees} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Active earnings"
          value={activeEarnings}
          accent="emerald"
          icon={<TrendingUp />}
          sub="Added to salary each run"
        />
        <StatTile
          label="Active deductions"
          value={activeDeductions}
          accent="rose"
          icon={<TrendingDown />}
          sub="Subtracted from salary each run"
        />
      </div>

      <RecurringTable rows={rows} />

      <p className="text-[12px] text-muted-foreground">
        Components apply automatically when payroll is processed, for every month from their start
        until their end (if set) while active. This screen manages them; it does not itself post any
        pay.
      </p>
    </div>
  );
}
