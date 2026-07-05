import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Banknote,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/../auth";
import { getPortalPayments } from "@/actions/portal.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { PAYMENT_STATUS_COLORS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";

// ============================================================
// Helpers
// ============================================================

const METHOD_LABELS: Record<string, string> = {
  RAZORPAY: "Razorpay",
  BANK_TRANSFER: "Bank Transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
  UPI: "UPI",
};

const METHOD_ICONS: Record<string, typeof CreditCard> = {
  RAZORPAY: CreditCard,
  BANK_TRANSFER: Banknote,
  CASH: Wallet,
  CHEQUE: Banknote,
  UPI: Wallet,
};

export const metadata: Metadata = { title: "My Payments" };

// ============================================================
// Payments Page
// ============================================================

export default async function PortalPaymentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const payments = await getPortalPayments(session.user.id);

  // Summary stats
  const completedPayments = payments.filter((p) => p.status === "COMPLETED");
  const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingPayments = payments.filter(
    (p) => p.status === "PENDING" || p.status === "PROCESSING"
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payment History"
        description="Track all your payments and receipts."
      />

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Total Paid</p>
                <p className="text-lg font-bold text-zinc-900">
                  {formatINR(totalPaid)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50">
                <CreditCard className="size-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">
                  Completed Payments
                </p>
                <p className="text-lg font-bold text-zinc-900">
                  {completedPayments.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Pending</p>
                <p className="text-lg font-bold text-zinc-900">
                  {pendingPayments.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments List */}
      {payments.length === 0 ? (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-zinc-100">
              <CreditCard className="size-8 text-zinc-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-900">
              No payments yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              Your payment history will appear here once you make a payment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-zinc-900">
              All Payments ({payments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Date
                    </th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Amount
                    </th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Method
                    </th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Receipt #
                    </th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Invoice
                    </th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Event
                    </th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Status
                    </th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {payments.map((payment) => {
                    const MethodIcon =
                      METHOD_ICONS[payment.method] || CreditCard;
                    return (
                      <tr
                        key={payment.id}
                        className="transition-colors hover:bg-zinc-50/50"
                      >
                        <td className="py-3 text-sm text-zinc-700">
                          {payment.paidAt
                            ? new Date(payment.paidAt).toLocaleDateString(
                                "en-IN",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )
                            : new Date(payment.createdAt).toLocaleDateString(
                                "en-IN",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                        </td>
                        <td className="py-3 text-sm font-semibold text-zinc-900">
                          {formatINR(payment.amount)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                            <MethodIcon className="size-3.5 text-zinc-400" />
                            {METHOD_LABELS[payment.method] || payment.method}
                          </div>
                        </td>
                        <td className="py-3 text-sm text-zinc-600">
                          {payment.receiptNumber || "-"}
                        </td>
                        <td className="py-3 text-sm text-indigo-600 font-medium">
                          {payment.invoiceNumber}
                        </td>
                        <td className="py-3 text-sm text-zinc-600 max-w-[150px] truncate">
                          {payment.eventName || "-"}
                        </td>
                        <td className="py-3">
                          <StatusBadge
                            status={payment.status}
                            colorMap={PAYMENT_STATUS_COLORS}
                            className="text-[10px]"
                          />
                        </td>
                        <td className="py-3 text-right">
                          {payment.status === "COMPLETED" &&
                            payment.invoiceId && (
                              <a
                                href={`/portal/invoices/${payment.invoiceId}/pdf?auto=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                                title="View invoice PDF"
                              >
                                <Download className="size-3.5" />
                              </a>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {payments.map((payment) => {
                const MethodIcon = METHOD_ICONS[payment.method] || CreditCard;
                return (
                  <div
                    key={payment.id}
                    className="rounded-lg border border-zinc-100 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-8 items-center justify-center rounded-full ${
                            payment.status === "COMPLETED"
                              ? "bg-emerald-100"
                              : payment.status === "FAILED"
                              ? "bg-red-100"
                              : "bg-zinc-100"
                          }`}
                        >
                          {payment.status === "COMPLETED" ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : payment.status === "FAILED" ? (
                            <AlertCircle className="size-4 text-red-600" />
                          ) : (
                            <Clock className="size-4 text-zinc-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">
                            {formatINR(payment.amount)}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {payment.invoiceNumber}
                          </p>
                        </div>
                      </div>
                      <StatusBadge
                        status={payment.status}
                        colorMap={PAYMENT_STATUS_COLORS}
                        className="text-[10px]"
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <MethodIcon className="size-3 text-zinc-400" />
                          {METHOD_LABELS[payment.method] || payment.method}
                        </div>
                        {payment.receiptNumber && (
                          <span>{payment.receiptNumber}</span>
                        )}
                      </div>
                      <span>
                        {payment.paidAt
                          ? new Date(payment.paidAt).toLocaleDateString(
                              "en-IN",
                              {
                                month: "short",
                                day: "numeric",
                              }
                            )
                          : new Date(payment.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                month: "short",
                                day: "numeric",
                              }
                            )}
                      </span>
                    </div>
                    {payment.eventName && (
                      <p className="mt-1.5 text-xs text-zinc-400 truncate">
                        {payment.eventName}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
