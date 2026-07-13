import { redirect } from "next/navigation";
import { ReceiptTextIcon, IndianRupeeIcon, ClockIcon, FileCheck2Icon } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { listVendorBills, getBillableBookingVendors } from "@/actions/vendor-bill.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { formatINR } from "@/lib/utils";
import { BillsTable } from "./_components/bills-table";
import { NewBillButton } from "./_components/new-bill-button";

export const metadata = {
  title: "Vendor Bills",
};

export default async function VendorBillsPage() {
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "payouts:read")) redirect("/payouts");

  const [bills, billable] = await Promise.all([
    listVendorBills(),
    getBillableBookingVendors(),
  ]);

  const totalOutstanding = bills.reduce((s, b) => s + (b.outstanding ?? 0), 0);
  const awaitingApproval = bills.filter((b) => b.effectiveStatus === "DRAFT").length;
  const approvedOutstanding = bills.filter(
    (b) => b.effectiveStatus === "APPROVED" && (b.outstanding ?? 0) > 0
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        icon={ReceiptTextIcon}
        accent="emerald"
        title="Vendor Bills"
        description="Accrue what vendors are owed and reconcile against payouts."
      >
        <NewBillButton billable={billable} />
      </PageHeader>

      {/* Stat strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Total Outstanding"
          value={formatINR(totalOutstanding)}
          accent="rose"
          icon={<IndianRupeeIcon className="size-4" />}
          sub={`${bills.length} bill${bills.length === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Awaiting Approval"
          value={awaitingApproval}
          accent="amber"
          icon={<ClockIcon className="size-4" />}
          sub="Draft bills to review"
        />
        <StatTile
          label="Approved · Owing"
          value={approvedOutstanding}
          accent="emerald"
          icon={<FileCheck2Icon className="size-4" />}
          sub="Accrued, not yet fully paid"
        />
      </div>

      <BillsTable data={bills} />
    </div>
  );
}
