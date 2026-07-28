import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Receipt, Clock, CheckCircle2, BadgeIndianRupee } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { listReimbursements, reimbursementStats } from "@/actions/hr-reimbursement.actions";
import { ReimbursementsTable } from "./_components/reimbursements-table";

export const metadata: Metadata = { title: "Reimbursement approvals" };

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export default async function ReimbursementsPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:payroll")) redirect("/people");

  const [rows, stats] = await Promise.all([listReimbursements(), reimbursementStats()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reimbursement approvals"
        description="Expense reimbursements submitted by employees. Approve a claim onto a pay run and payroll disburses it automatically; reject with a note. Reimbursements are non-taxable unless you flag them."
        icon={Receipt}
        accent="emerald"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Pending review"
          value={stats.pending}
          accent="amber"
          icon={<Clock />}
          sub="Awaiting your decision"
        />
        <StatTile
          label="Approved, awaiting pay"
          value={stats.approved}
          accent="indigo"
          icon={<CheckCircle2 />}
          sub="Queued for a pay run"
        />
        <StatTile
          label="Pending amount"
          value={inr(stats.pendingAmount)}
          accent="emerald"
          icon={<BadgeIndianRupee />}
          sub="Across pending claims"
        />
      </div>

      <ReimbursementsTable rows={rows} />

      <p className="text-[12px] text-muted-foreground">
        Approving a claim assigns it to a pay run (financial year + month). The claim is disbursed
        and stamped paid automatically when that payroll run is processed; this screen does not post
        any payment itself.
      </p>
    </div>
  );
}
