import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import {
  getUninvoicedBookings,
  getPayoutStatements,
} from "@/actions/finance-revenue.actions";
import { RevenueWorkspace } from "./_components/revenue-workspace";

export const metadata = { title: "Revenue Automation · Veloria Grand" };

export default async function FinanceRevenuePage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");

  const [uninvoiced, statements] = await Promise.all([
    getUninvoicedBookings(),
    getPayoutStatements(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Finance · Revenue Automation"
        title="Revenue Automation"
        description="Turn confirmed contracts into invoices and track vendor payout statements — all read-derived, nothing posts to the ledger."
      />
      <RevenueWorkspace uninvoiced={uninvoiced} statements={statements} />
    </div>
  );
}
