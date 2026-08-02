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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Your account"
        title="Payment History"
        description="Every payment you've made, with receipts you can pull up any time."
      />

      {/* Summary */}
      <div className="grid gap-5 sm:grid-cols-3">
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-success/10">
                <CheckCircle2 className="size-5 text-success" />
              </div>
              <div>
                <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.14em]">
                  Total paid
                </p>
                <p className="numeric text-foreground mt-1 text-title font-semibold">
                  {formatINR(totalPaid)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-3.5">
              <div className="bg-primary/10 flex size-11 items-center justify-center rounded-xl">
                <CreditCard className="text-primary size-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.14em]">
                  Settled
                </p>
                <p className="numeric text-foreground mt-1 text-title font-semibold">
                  {completedPayments.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-warning/10">
                <Clock className="size-5 text-warning" />
              </div>
              <div>
                <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.14em]">
                  In progress
                </p>
                <p className="numeric text-foreground mt-1 text-title font-semibold">
                  {pendingPayments.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments List */}
      {payments.length === 0 ? (
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
              <CreditCard className="text-muted-foreground/60 size-8" />
            </div>
            <h3 className="font-editorial text-foreground mt-5 text-xl font-semibold">
              Nothing paid yet
            </h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              The moment your first payment goes through, it lands here with its
              receipt — permanently.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card rounded-2xl py-0">
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle className="font-editorial text-foreground text-title font-semibold">
              All payments
              <span className="numeric text-muted-foreground/60 ml-2 text-sm font-normal">
                {payments.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-muted-foreground pb-3 text-left text-meta font-semibold uppercase tracking-[0.14em]">
                      Date
                    </th>
                    <th className="text-muted-foreground pb-3 text-right text-meta font-semibold uppercase tracking-[0.14em]">
                      Amount
                    </th>
                    <th className="text-muted-foreground pb-3 text-left text-meta font-semibold uppercase tracking-[0.14em]">
                      Method
                    </th>
                    <th className="text-muted-foreground pb-3 text-left text-meta font-semibold uppercase tracking-[0.14em]">
                      Receipt #
                    </th>
                    <th className="text-muted-foreground pb-3 text-left text-meta font-semibold uppercase tracking-[0.14em]">
                      Invoice
                    </th>
                    <th className="text-muted-foreground pb-3 text-left text-meta font-semibold uppercase tracking-[0.14em]">
                      Event
                    </th>
                    <th className="text-muted-foreground pb-3 text-left text-meta font-semibold uppercase tracking-[0.14em]">
                      Status
                    </th>
                    <th className="text-muted-foreground pb-3 text-right text-meta font-semibold uppercase tracking-[0.14em]">
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {payments.map((payment) => {
                    const MethodIcon =
                      METHOD_ICONS[payment.method] || CreditCard;
                    return (
                      <tr
                        key={payment.id}
                        className="hover:bg-muted/60 transition-colors"
                      >
                        <td className="numeric text-muted-foreground py-3.5 text-sm">
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
                        <td className="numeric text-foreground py-3.5 text-right text-sm font-semibold">
                          {formatINR(payment.amount)}
                        </td>
                        <td className="py-3.5">
                          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                            <MethodIcon className="text-muted-foreground/50 size-3.5" />
                            {METHOD_LABELS[payment.method] || payment.method}
                          </div>
                        </td>
                        <td className="numeric text-muted-foreground py-3.5 text-sm">
                          {payment.receiptNumber || "—"}
                        </td>
                        <td className="numeric text-primary py-3.5 text-sm font-medium">
                          {payment.invoiceNumber}
                        </td>
                        <td className="text-muted-foreground max-w-[150px] truncate py-3.5 text-sm">
                          {payment.eventName || "—"}
                        </td>
                        <td className="py-3.5">
                          <StatusBadge
                            status={payment.status}
                            colorMap={PAYMENT_STATUS_COLORS}
                            className="text-meta"
                          />
                        </td>
                        <td className="py-3.5 text-right">
                          {payment.status === "COMPLETED" &&
                            payment.invoiceId && (
                              <a
                                href={`/portal/invoices/${payment.invoiceId}/pdf?auto=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground/60 hover:text-primary inline-flex items-center gap-1 text-xs font-medium transition-colors"
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
                    className="rounded-xl border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-9 items-center justify-center rounded-xl ${
                            payment.status === "COMPLETED"
                              ? "bg-success/10"
                              : payment.status === "FAILED"
                              ? "bg-destructive/10"
                              : "bg-muted"
                          }`}
                        >
                          {payment.status === "COMPLETED" ? (
                            <CheckCircle2 className="size-4 text-success" />
                          ) : payment.status === "FAILED" ? (
                            <AlertCircle className="size-4 text-destructive" />
                          ) : (
                            <Clock className="text-muted-foreground/60 size-4" />
                          )}
                        </div>
                        <div>
                          <p className="numeric text-foreground text-sm font-semibold">
                            {formatINR(payment.amount)}
                          </p>
                          <p className="numeric text-muted-foreground text-xs">
                            {payment.invoiceNumber}
                          </p>
                        </div>
                      </div>
                      <StatusBadge
                        status={payment.status}
                        colorMap={PAYMENT_STATUS_COLORS}
                        className="text-meta"
                      />
                    </div>
                    <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <MethodIcon className="text-muted-foreground/50 size-3" />
                          {METHOD_LABELS[payment.method] || payment.method}
                        </div>
                        {payment.receiptNumber && (
                          <span className="numeric">
                            {payment.receiptNumber}
                          </span>
                        )}
                      </div>
                      <span className="numeric">
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
                      <p className="text-muted-foreground/70 mt-1.5 truncate text-xs">
                        {payment.eventName}
                      </p>
                    )}
                    {/* The receipt link existed only in the desktop table, so a
                        customer on a phone — which is nearly all of them — had
                        no way to pull up the receipt this page promises. */}
                    {payment.status === "COMPLETED" && payment.invoiceId && (
                      <a
                        href={`/portal/invoices/${payment.invoiceId}/pdf?auto=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary hover:border-primary/30 mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                      >
                        <Download className="size-3.5" />
                        Receipt
                      </a>
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
