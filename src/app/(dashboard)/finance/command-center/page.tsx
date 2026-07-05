// ============================================================
// Finance · Command Center — the owner cockpit. A single read-only glance at
// the money: cash on hand, this month's P&L, what's awaiting a sign-off, and
// where the spend is going this year. All numbers are derived from POSTED
// ledger movements (drafts only appear in the approvals inbox). No posting.
// ============================================================

import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getCommandCenter } from "@/actions/finance-cockpit.actions";
import { CockpitHero } from "./_components/cockpit-hero";
import { CockpitStats } from "./_components/cockpit-stats";
import { ApprovalsInbox } from "./_components/approvals-inbox";
import { TopExpenses } from "./_components/top-expenses";

export const metadata = { title: "Command Center · Finance · Veloria Grand" };

export default async function CommandCenterPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");

  const data = await getCommandCenter();

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Finance · Command Center"
        title="Owner cockpit"
        description="A live, read-only read of the money — cash on hand, this month's profit, what's awaiting sign-off, and where the spend is going this year."
      />

      <CockpitHero
        fy={data.fy}
        cashPosition={data.cashPosition}
        mtdRevenue={data.mtd.revenue}
        mtdExpense={data.mtd.expense}
        mtdNet={data.mtd.net}
      />

      <CockpitStats
        cashPosition={data.cashPosition}
        mtdRevenue={data.mtd.revenue}
        mtdExpense={data.mtd.expense}
        mtdNet={data.mtd.net}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ApprovalsInbox approvals={data.approvals} count={data.approvalsCount} />
        <TopExpenses fy={data.fy} rows={data.topExpenses} />
      </div>
    </div>
  );
}
