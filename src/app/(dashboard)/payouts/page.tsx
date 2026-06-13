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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PayoutTable } from "./_components/payout-table";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        help={<PageHelp id="payouts" />}
        description="Manage vendor payments, owner payouts, and commissions."
      >
        <Button asChild>
          <Link href="/payouts/new">
            <PlusIcon className="mr-2 size-4" />
            Create Payout
          </Link>
        </Button>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
            <ClockIcon className="size-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">
              {formatINR(stats?.totalPending ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.pendingCount ?? 0} payout(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
            <CheckCircleIcon className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {formatINR(stats?.totalApproved ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.approvedCount ?? 0} payout(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid
            </CardTitle>
            <IndianRupeeIcon className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {formatINR(stats?.totalPaid ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.paidCount ?? 0} payout(s)
            </p>
          </CardContent>
        </Card>
      </div>

      <PayoutTable data={payouts} />
    </div>
  );
}
