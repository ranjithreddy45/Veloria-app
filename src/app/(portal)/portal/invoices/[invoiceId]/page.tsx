import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building2,
  User,
  IndianRupee,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/../auth";
import { getPortalInvoice } from "@/actions/portal.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  INVOICE_STATUS_COLORS,
  PAYMENT_STATUS_COLORS,
} from "@/lib/constants";
import { RazorpayCheckout } from "../_components/razorpay-checkout";
import { UploadProof } from "../_components/upload-proof";
import { DownloadPdfButton } from "@/app/(dashboard)/invoices/[invoiceId]/_components/download-pdf-button";
import { formatINR } from "@/lib/utils";

// ============================================================
// Helpers
// ============================================================

function formatINRRound(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================
// Invoice Detail Page
// ============================================================

export default async function PortalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const { invoiceId } = await params;
  const invoice = await getPortalInvoice(session.user.id, invoiceId);

  if (!invoice) notFound();

  const isPayable =
    invoice.balanceDue > 0 &&
    invoice.status !== "CANCELLED" &&
    invoice.status !== "DRAFT" &&
    invoice.status !== "REFUNDED";

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/portal/invoices"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
      >
        <ArrowLeft className="size-4" />
        Back to Invoices
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {invoice.invoiceNumber}
            </h1>
            <StatusBadge
              status={invoice.status}
              colorMap={INVOICE_STATUS_COLORS}
            />
          </div>
          {invoice.booking && (
            <p className="mt-1 text-sm text-zinc-500">
              {invoice.booking.eventName}
              {invoice.booking.bookingNumber && (
                <> &middot; Booking #{invoice.booking.bookingNumber}</>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <DownloadPdfButton invoiceId={invoiceId} />
          <div className="text-right">
            <p className="text-sm text-zinc-400">Total Amount</p>
            <p className="text-2xl font-bold text-zinc-900">
              {formatINRRound(invoice.totalAmount)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Invoice Info */}
          <Card className="border-zinc-200/80 shadow-sm overflow-hidden">
            {/* Invoice Meta */}
            <div className="grid grid-cols-2 gap-4 border-b border-zinc-100 bg-zinc-50/50 p-5 sm:grid-cols-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Issue Date
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {new Date(invoice.issueDate).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Due Date
                </p>
                <p
                  className={`mt-1 text-sm font-medium ${
                    invoice.status === "OVERDUE"
                      ? "text-red-600"
                      : "text-zinc-900"
                  }`}
                >
                  {new Date(invoice.dueDate).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              {invoice.gstin && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    GSTIN
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">
                    {invoice.gstin}
                  </p>
                </div>
              )}
              {invoice.placeOfSupply && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Place of Supply
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">
                    {invoice.placeOfSupply}
                  </p>
                </div>
              )}
            </div>

            {/* Billed To */}
            <div className="border-b border-zinc-100 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <User className="size-3.5" />
                Billed To
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium text-zinc-900">
                  {invoice.contact.firstName} {invoice.contact.lastName}
                </p>
                {invoice.contact.company && (
                  <p className="text-sm text-zinc-500">
                    {invoice.contact.company}
                  </p>
                )}
                {invoice.contact.email && (
                  <p className="text-sm text-zinc-500">
                    {invoice.contact.email}
                  </p>
                )}
                {(invoice.contact.address ||
                  invoice.contact.city ||
                  invoice.contact.state) && (
                  <p className="text-sm text-zinc-500">
                    {[
                      invoice.contact.address,
                      invoice.contact.city,
                      invoice.contact.state,
                      invoice.contact.pincode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>

            {/* Line Items */}
            <div className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Line Items
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Description
                      </th>
                      <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Qty
                      </th>
                      <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Rate
                      </th>
                      <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {invoice.lineItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 text-sm text-zinc-700">
                          {item.description}
                          {item.sacCode && (
                            <span className="block text-xs text-zinc-400">
                              SAC: {item.sacCode}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right text-sm text-zinc-700">
                          {item.quantity}
                        </td>
                        <td className="py-3 text-right text-sm text-zinc-700">
                          {formatINR(item.unitPrice)}
                        </td>
                        <td className="py-3 text-right text-sm font-medium text-zinc-900">
                          {formatINR(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-4 border-t border-zinc-100 pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Subtotal</span>
                  <span className="text-zinc-900">
                    {formatINR(invoice.subtotal)}
                  </span>
                </div>

                {invoice.discountAmount && invoice.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">
                      Discount
                      {invoice.discountPercent
                        ? ` (${invoice.discountPercent}%)`
                        : ""}
                    </span>
                    <span className="text-emerald-600">
                      -{formatINR(invoice.discountAmount)}
                    </span>
                  </div>
                )}

                {invoice.cgstAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">
                      CGST ({invoice.cgstRate}%)
                    </span>
                    <span className="text-zinc-900">
                      {formatINR(invoice.cgstAmount)}
                    </span>
                  </div>
                )}

                {invoice.sgstAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">
                      SGST ({invoice.sgstRate}%)
                    </span>
                    <span className="text-zinc-900">
                      {formatINR(invoice.sgstAmount)}
                    </span>
                  </div>
                )}

                {invoice.igstAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">
                      IGST ({invoice.igstRate}%)
                    </span>
                    <span className="text-zinc-900">
                      {formatINR(invoice.igstAmount)}
                    </span>
                  </div>
                )}

                <div className="h-px bg-zinc-200" />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900">
                    Total
                  </span>
                  <span className="text-lg font-bold text-zinc-900">
                    {formatINR(invoice.totalAmount)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Paid</span>
                  <span className="text-sm font-medium text-emerald-600">
                    {formatINR(invoice.paidAmount)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                  <span className="text-sm font-semibold text-zinc-700">
                    Balance Due
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      invoice.balanceDue > 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {formatINR(invoice.balanceDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes & Terms */}
            {(invoice.notes || invoice.terms) && (
              <div className="border-t border-zinc-100 p-5 space-y-4">
                {invoice.notes && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Notes
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 whitespace-pre-line">
                      {invoice.notes}
                    </p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Terms & Conditions
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 whitespace-pre-line">
                      {invoice.terms}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Payment History */}
          {invoice.payments.length > 0 && (
            <Card className="border-zinc-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                  <CreditCard className="size-4 text-indigo-500" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center gap-4 rounded-lg border border-zinc-100 p-4"
                    >
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-900">
                            {formatINR(payment.amount)}
                          </p>
                          <StatusBadge
                            status={payment.status}
                            colorMap={PAYMENT_STATUS_COLORS}
                            className="text-[10px]"
                          />
                        </div>
                        <p className="text-xs text-zinc-500">
                          {payment.method.replace(/_/g, " ")}
                          {payment.receiptNumber && (
                            <> &middot; {payment.receiptNumber}</>
                          )}
                          {payment.paidAt && (
                            <>
                              {" "}&middot;{" "}
                              {new Date(payment.paidAt).toLocaleDateString(
                                "en-IN",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      {payment.transactionId && (
                        <span className="hidden text-xs text-zinc-400 sm:inline">
                          {payment.transactionId}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Payment CTA */}
          {isPayable && (
            <Card className="border-indigo-200 bg-gradient-to-br from-white to-indigo-50/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                  <IndianRupee className="size-4 text-indigo-500" />
                  Make a Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Amount Due</span>
                    <span className="text-lg font-bold text-red-600">
                      {formatINRRound(invoice.balanceDue)}
                    </span>
                  </div>
                </div>
                <RazorpayCheckout
                  invoiceId={invoice.id}
                  invoiceNumber={invoice.invoiceNumber}
                  amount={Number(invoice.balanceDue)}
                  customerName={`${invoice.contact.firstName} ${invoice.contact.lastName}`}
                  customerEmail={invoice.contact.email || ""}
                  customerPhone={invoice.contact.phone || undefined}
                  description={`Payment for Invoice ${invoice.invoiceNumber}`}
                />
                <div className="mt-3">
                  <UploadProof
                    userId={session.user.id}
                    invoiceId={invoice.id}
                    balanceDue={Number(invoice.balanceDue)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Paid Badge */}
          {invoice.status === "PAID" && (
            <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <CheckCircle2 className="size-12 text-emerald-600" />
                <h3 className="mt-3 text-base font-semibold text-emerald-900">
                  Fully Paid
                </h3>
                <p className="mt-1 text-sm text-emerald-700">
                  This invoice has been paid in full. Thank you!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Installment Schedule */}
          {invoice.installments.length > 0 && (
            <Card className="border-zinc-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-zinc-900">
                  Payment Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invoice.installments.map((inst, idx) => {
                    const isPaid = inst.status === "COMPLETED";
                    const isOverdue =
                      !isPaid && new Date(inst.dueDate) < new Date();
                    return (
                      <div
                        key={inst.id}
                        className={`rounded-lg border p-3 ${
                          isPaid
                            ? "border-emerald-200 bg-emerald-50/50"
                            : isOverdue
                            ? "border-red-200 bg-red-50/50"
                            : "border-zinc-100"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                                isPaid
                                  ? "bg-emerald-100 text-emerald-700"
                                  : isOverdue
                                  ? "bg-red-100 text-red-700"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {idx + 1}
                            </div>
                            <span className="text-sm font-medium text-zinc-900">
                              {inst.label}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-zinc-900">
                            {formatINRRound(inst.amount)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between pl-8">
                          <span
                            className={`text-xs ${
                              isOverdue ? "text-red-600 font-medium" : "text-zinc-400"
                            }`}
                          >
                            Due:{" "}
                            {new Date(inst.dueDate).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          {isPaid && (
                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                              <CheckCircle2 className="size-3" />
                              Paid
                              {inst.paidAt && (
                                <>
                                  {" "}
                                  {new Date(inst.paidAt).toLocaleDateString(
                                    "en-IN",
                                    {
                                      month: "short",
                                      day: "numeric",
                                    }
                                  )}
                                </>
                              )}
                            </span>
                          )}
                          {isOverdue && (
                            <span className="text-xs font-semibold text-red-600">
                              Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Info */}
          <Card className="border-zinc-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Invoice Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Invoice #</span>
                  <span className="font-medium text-zinc-900">
                    {invoice.invoiceNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Line Items</span>
                  <span className="font-medium text-zinc-900">
                    {invoice.lineItems.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Payments</span>
                  <span className="font-medium text-zinc-900">
                    {invoice.payments.filter((p) => p.status === "COMPLETED")
                      .length}
                  </span>
                </div>
                {invoice.sacCode && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">SAC Code</span>
                    <span className="font-medium text-zinc-900">
                      {invoice.sacCode}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
