import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Receipt, BadgeIndianRupee, CheckCircle2 } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { mayMarkClaimPaid } from "@/lib/hr/claim-payment";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { listFinanceReimbursements } from "@/actions/hr-reimbursement.actions";
import { FinanceReimbursementsTable } from "./_components/finance-reimbursements-table";

export const metadata: Metadata = { title: "Reimbursement payments" };

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// ============================================================
// Finance's view of expense claims: ONLY approved claims reach this page
// ("Approved – Pending Payment"). Finance opens the bills, records the payment
// (date, amount, mode, UTR) and the claim becomes Paid — or schedules it on a
// payroll run. Others who can read finance (Admins, HR) see the list and the
// payment details but get no payment buttons: only the FINANCE role pays.
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
        description="Approved employee expense claims. Open the bills and approval history, then mark each one paid with the payment date, amount, mode and UTR reference. Claims still awaiting approval never appear here."
        icon={Receipt}
        accent="emerald"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Ready to pay" value={awaiting.length} accent="indigo" icon={<CheckCircle2 />} sub="Approved – Pending Payment" />
        <StatTile label="Amount to pay" value={inr(awaitingAmount)} accent="emerald" icon={<BadgeIndianRupee />} sub="Across approved claims" />
        <StatTile label="Paid" value={paid.length} accent="blue" icon={<Receipt />} sub="Settled claims" />
      </div>

      <FinanceReimbursementsTable rows={rows} canPay={mayMarkClaimPaid(role)} />
    </div>
  );
}
