import {
  IndianRupeeIcon,
  ClockIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { getPayments, getPaymentStats } from "@/actions/payment.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentsTable } from "./_components/payments-table";
import { formatINR } from "@/lib/utils";

export const metadata = {
  title: "Payments",
};

export default async function PaymentsPage() {
  const [paymentsResult, statsResult] = await Promise.all([
    getPayments(),
    getPaymentStats(),
  ]);

  const payments = paymentsResult.success
    ? paymentsResult.data?.data ?? []
    : [];
  const stats = statsResult.success
    ? statsResult.data
    : { todayCollections: 0, pendingPayments: 0, overdueAmount: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        help={<PageHelp id="payments" />}
        description="Track payment collections, pending and overdue amounts."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today&apos;s Collections
            </CardTitle>
            <IndianRupeeIcon className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatINR(stats?.todayCollections ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Payments
            </CardTitle>
            <ClockIcon className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {formatINR(stats?.pendingPayments ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue Amount
            </CardTitle>
            <AlertTriangleIcon className="size-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {formatINR(stats?.overdueAmount ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <PaymentsTable data={payments} />
    </div>
  );
}
