import Link from "next/link";
import {
  IndianRupeeIcon,
  ClockIcon,
  CheckCircleIcon,
  PlusIcon,
} from "lucide-react";

import { getPayouts, getPayoutStats } from "@/actions/payout.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { PayoutsView } from "./_components/payouts-view";
import { formatINR } from "@/lib/utils";

export const metadata = {
  title: "Payouts",
};

export default async function PayoutsPage() {
  const [payoutsResult, statsResult] = await Promise.all([
    getPayouts(),
    getPayoutStats(),
  ]);

  const payouts = payoutsResult.success ? payoutsResult.data ?? [] : [];
  const stats = statsResult.success
    ? statsResult.data
    : {
        totalPending: 0,
        pendingCount: 0,
        totalApproved: 0,
        approvedCount: 0,
        totalPaid: 0,
        paidCount: 0,
      };

  const totalPending = stats?.totalPending ?? 0;
  const totalApproved = stats?.totalApproved ?? 0;
  const totalPaid = stats?.totalPaid ?? 0;
  const pendingCount = stats?.pendingCount ?? 0;
  const approvedCount = stats?.approvedCount ?? 0;
  const paidCount = stats?.paidCount ?? 0;

  const totalAmount = totalPending + totalApproved + totalPaid;
  const totalCount = pendingCount + approvedCount + paidCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        help={<PageHelp id="payouts" />}
        eyebrow={
          <span className="tabular-nums">
            {totalCount} payout{totalCount === 1 ? "" : "s"} ·{" "}
            {formatINR(totalAmount)} total · {formatINR(totalPending)} pending
          </span>
        }
        description="Manage vendor payments, owner payouts, and commissions."
      >
        <Button asChild>
          <Link href="/payouts/new">
            <PlusIcon className="mr-2 size-4" />
            Create Payout
          </Link>
        </Button>
      </PageHeader>

      {/* Stat strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Total Payouts"
          value={formatINR(totalAmount)}
          accent="emerald"
          icon={<IndianRupeeIcon className="size-4" />}
          sub={`${totalCount} payout${totalCount === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Pending"
          value={formatINR(totalPending)}
          accent="amber"
          icon={<ClockIcon className="size-4" />}
          sub={`${pendingCount} payout${pendingCount === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Paid"
          value={formatINR(totalPaid)}
          accent="rose"
          icon={<CheckCircleIcon className="size-4" />}
          sub={`${paidCount} payout${paidCount === 1 ? "" : "s"}`}
        />
      </div>

      <PayoutsView data={payouts} />
    </div>
  );
}
