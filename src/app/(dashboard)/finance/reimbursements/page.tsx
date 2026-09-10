import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Receipt, BadgeIndianRupee, CheckCircle2 } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { listFinanceReimbursements } from "@/actions/hr-reimbursement.actions";
import { FinanceReimbursementsTable } from "./_components/finance-reimbursements-table";

export const metadata: Metadata = { title: "Reimbursement payments" };

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// ============================================================
// Finance's view of expense claims: ONLY claims that have completed every
// approval reach this page. Finance schedules them on a payroll run (payroll
// disburses and stamps PAID) or records a direct payment.
// ============================================================

export default async function FinanceReimbursementsPage() {
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "finance:read") && !hasPermission(role, "hr:payroll")) redirect("/finance");

  const rows = await listFinanceReimbursements();
  const awaiting = rows.filter((r) => r.status === "APPROVED");
  const awaitingAmount = awaiting.reduce((s, r) => s + r.amount, 0);
  const paid = rows.filter((r) => r.status === "PAID");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reimbursement payments"
        description="Employee expense claims that have completed first- and second-level approval. Schedule each on a pay run, or record a direct payment. Claims still in approval never appear here."
        icon={Receipt}
        accent="emerald"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Ready to pay" value={awaiting.length} accent="indigo" icon={<CheckCircle2 />} sub="Fully approved, unpaid" />
        <StatTile label="Amount to pay" value={inr(awaitingAmount)} accent="emerald" icon={<BadgeIndianRupee />} sub="Across approved claims" />
        <StatTile label="Paid" value={paid.length} accent="blue" icon={<Receipt />} sub="Settled claims" />
      </div>

      <FinanceReimbursementsTable rows={rows} />
    </div>
  );
}
