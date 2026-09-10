import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Receipt, Clock, CheckCircle2, BadgeIndianRupee, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        description="Every expense claim and where it stands. Claims go to the first-level approver, then the second-level approver for the employee's department, and only then to Finance for payment. Each step is recorded on the claim with name and time."
        icon={Receipt}
        accent="emerald"
      >
        <Button variant="outline" asChild>
          <Link href="/people/payroll/reimbursements/approvers">
            <UserCheck className="mr-2 size-4" /> Approvers
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Pending review"
          value={stats.pending}
          accent="amber"
          icon={<Clock />}
          sub="Awaiting 1st or 2nd approval"
        />
        <StatTile
          label="Approved, awaiting pay"
          value={stats.approved}
          accent="indigo"
          icon={<CheckCircle2 />}
          sub="With Finance for payment"
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

      <p className="text-detail text-muted-foreground">
        Approvals here are only available to the configured approver for that step (and Super Admins).
        Finance schedules approved claims on a pay run or records a direct payment under Accounting → Reimbursements.
      </p>
    </div>
  );
}
