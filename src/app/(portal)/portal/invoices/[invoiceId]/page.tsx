import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
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
import { PortalPdfButton } from "../_components/portal-pdf-button";
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

function shortDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Quiet uppercase micro-label used across the document surfaces.
const LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

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
    <div className="space-y-8">
      {/* Back Button */}
      <Link
        href="/portal/invoices"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-[13px] transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to invoices
      </Link>

      {/* Header — the invoice number is the identity of this page */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className={LABEL}>Invoice</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="large-title text-foreground text-[28px] leading-tight sm:text-[32px]">
              {invoice.invoiceNumber}
            </h1>
            <StatusBadge
              status={invoice.status}
              colorMap={INVOICE_STATUS_COLORS}
            />
          </div>
          {invoice.booking && (
            <p className="text-muted-foreground text-[15px]">
              {invoice.booking.eventName}
              {invoice.booking.bookingNumber && (
                <>
                  {" "}
                  &middot; Booking{" "}
                  <span className="numeric">
                    {invoice.booking.bookingNumber}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-5">
          <PortalPdfButton invoiceId={invoiceId} />
          <div className="text-right">
            <p className={LABEL}>Total</p>
            <p className="numeric text-foreground mt-1 text-[26px] font-semibold leading-none">
              {formatINRRound(invoice.totalAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* On a phone the two columns stack, and the right one holds the "Settle
          your balance" CTA and the payment schedule. Left in source order that
          buried the Pay button under the entire invoice document plus payment
          history — several screens of scrolling before the one action the
          customer opened the page to take. Order is flipped below lg only. */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="order-2 space-y-6 lg:order-1 lg:col-span-2">
          {/* Invoice Document */}
          <Card className="shadow-card overflow-hidden rounded-2xl py-0">
            {/* Invoice Meta */}
            <div className="bg-muted/30 grid grid-cols-2 gap-5 border-b p-6 sm:grid-cols-4">
              <div>
                <p className={LABEL}>Issued</p>
                <p className="numeric text-foreground mt-1.5 text-sm font-medium">
                  {shortDate(invoice.issueDate)}
                </p>
              </div>
              <div>
                <p className={LABEL}>Due</p>
                <p
                  className={`numeric mt-1.5 text-sm font-medium ${
                    invoice.status === "OVERDUE"
                      ? "text-destructive"
                      : "text-foreground"
                  }`}
                >
                  {shortDate(invoice.dueDate)}
                </p>
              </div>
              {invoice.gstin && (
                <div>
                  <p className={LABEL}>GSTIN</p>
                  <p className="numeric text-foreground mt-1.5 text-sm font-medium">
                    {invoice.gstin}
                  </p>
                </div>
              )}
              {invoice.placeOfSupply && (
                <div>
                  <p className={LABEL}>Place of supply</p>
                  <p className="text-foreground mt-1.5 text-sm font-medium">
                    {invoice.placeOfSupply}
                  </p>
                </div>
              )}
            </div>

            {/* Billed To */}
            <div className="border-b p-6">
              <div className={`flex items-center gap-2 ${LABEL}`}>
                <User className="size-3.5" />
                Billed to
              </div>
              <div className="mt-2.5 space-y-0.5">
                <p className="text-foreground text-sm font-medium">
                  {invoice.contact.firstName} {invoice.contact.lastName}
                </p>
                {invoice.contact.company && (
                  <p className="text-muted-foreground text-sm">
                    {invoice.contact.company}
                  </p>
                )}
                {invoice.contact.email && (
                  <p className="text-muted-foreground text-sm">
                    {invoice.contact.email}
                  </p>
                )}
                {(invoice.contact.address ||
                  invoice.contact.city ||
                  invoice.contact.state) && (
                  <p className="text-muted-foreground text-sm leading-relaxed">
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
            <div className="p-6">
              <h2 className={`${LABEL} mb-3`}>What you&apos;re paying for</h2>

              {/* Mobile: stacked rows. The four-column table squeezed the
                  description to ~105px at 375px, wrapping every line item over
                  three or four lines and making the invoice unreadable. */}
              <div className="divide-border/60 divide-y sm:hidden">
                {invoice.lineItems.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0">
                    <p className="text-foreground text-sm leading-snug">
                      {item.description}
                    </p>
                    {item.sacCode && (
                      <p className="numeric text-muted-foreground/70 mt-0.5 text-xs">
                        SAC {item.sacCode}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-baseline justify-between gap-3">
                      <span className="numeric text-muted-foreground text-xs">
                        {item.quantity} &times; {formatINR(item.unitPrice)}
                      </span>
                      <span className="numeric text-foreground shrink-0 text-sm font-medium">
                        {formatINR(item.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Description
                      </th>
                      <th className="pb-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Qty
                      </th>
                      <th className="pb-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Rate
                      </th>
                      <th className="pb-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/60 divide-y">
                    {invoice.lineItems.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="text-foreground py-3.5 pr-4 text-sm">
                          {item.description}
                          {item.sacCode && (
                            <span className="numeric text-muted-foreground/70 mt-0.5 block text-xs">
                              SAC {item.sacCode}
                            </span>
                          )}
                        </td>
                        <td className="numeric text-muted-foreground py-3.5 text-right text-sm">
                          {item.quantity}
                        </td>
                        <td className="numeric text-muted-foreground py-3.5 text-right text-sm">
                          {formatINR(item.unitPrice)}
                        </td>
                        <td className="numeric text-foreground py-3.5 pl-4 text-right text-sm font-medium">
                          {formatINR(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-5 space-y-2.5 border-t pt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="numeric text-foreground">
                    {formatINR(invoice.subtotal)}
                  </span>
                </div>

                {invoice.discountAmount && invoice.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Discount
                      {invoice.discountPercent
                        ? ` (${invoice.discountPercent}%)`
                        : ""}
                    </span>
                    <span className="numeric text-success font-medium">
                      -{formatINR(invoice.discountAmount)}
                    </span>
                  </div>
                )}

                {invoice.cgstAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      CGST ({invoice.cgstRate}%)
                    </span>
                    <span className="numeric text-foreground">
                      {formatINR(invoice.cgstAmount)}
                    </span>
                  </div>
                )}

                {invoice.sgstAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      SGST ({invoice.sgstRate}%)
                    </span>
                    <span className="numeric text-foreground">
                      {formatINR(invoice.sgstAmount)}
                    </span>
                  </div>
                )}

                {invoice.igstAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      IGST ({invoice.igstRate}%)
                    </span>
                    <span className="numeric text-foreground">
                      {formatINR(invoice.igstAmount)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-foreground text-sm font-semibold">
                    Total
                  </span>
                  <span className="numeric text-foreground text-[19px] font-semibold">
                    {formatINR(invoice.totalAmount)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Paid so far</span>
                  <span className="numeric text-success font-medium">
                    {formatINR(invoice.paidAmount)}
                  </span>
                </div>

                <div className="bg-muted/50 flex items-center justify-between rounded-xl px-4 py-3">
                  <span className="text-foreground text-sm font-semibold">
                    Balance due
                  </span>
                  <span
                    className={`numeric text-[19px] font-semibold ${
                      invoice.balanceDue > 0
                        ? "text-destructive"
                        : "text-success"
                    }`}
                  >
                    {formatINR(invoice.balanceDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes & Terms */}
            {(invoice.notes || invoice.terms) && (
              <div className="space-y-5 border-t p-6">
                {invoice.notes && (
                  <div>
                    <p className={LABEL}>Notes</p>
                    <p className="text-muted-foreground mt-1.5 whitespace-pre-line text-sm leading-relaxed">
                      {invoice.notes}
                    </p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <p className={LABEL}>Terms &amp; conditions</p>
                    <p className="text-muted-foreground mt-1.5 whitespace-pre-line text-sm leading-relaxed">
                      {invoice.terms}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Payment History */}
          {invoice.payments.length > 0 && (
            <Card className="shadow-card rounded-2xl py-0">
              <CardHeader className="px-6 pb-4 pt-6">
                <CardTitle className="flex items-center gap-2.5">
                  <CreditCard className="text-primary size-4" />
                  <span className="font-editorial text-foreground text-[20px] font-semibold">
                    Every payment so far
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-3">
                  {invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="hover:bg-muted/40 flex items-center gap-4 rounded-xl border p-4 transition-colors"
                    >
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                          payment.status === "COMPLETED"
                            ? "bg-success/12 text-success"
                            : payment.status === "FAILED"
                              ? "bg-destructive/12 text-destructive"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {payment.status === "COMPLETED" ? (
                          <CheckCircle2 className="size-4" />
                        ) : payment.status === "FAILED" ? (
                          <AlertCircle className="size-4" />
                        ) : (
                          <Clock className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="numeric text-foreground text-sm font-semibold">
                            {formatINR(payment.amount)}
                          </p>
                          <StatusBadge
                            status={payment.status}
                            colorMap={PAYMENT_STATUS_COLORS}
                            className="text-[10px]"
                          />
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {payment.method.replace(/_/g, " ")}
                          {payment.receiptNumber && (
                            <>
                              {" "}
                              &middot;{" "}
                              <span className="numeric">
                                {payment.receiptNumber}
                              </span>
                            </>
                          )}
                          {payment.paidAt && (
                            <>
                              {" "}
                              &middot;{" "}
                              <span className="numeric">
                                {shortDate(payment.paidAt)}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      {payment.transactionId && (
                        <span className="numeric text-muted-foreground/60 hidden text-xs sm:inline">
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
        <div className="order-1 space-y-6 lg:order-2">
          {/* Payment CTA */}
          {isPayable && (
            <Card className="shadow-card border-primary/20 bg-primary/[0.04] rounded-2xl py-0">
              <CardHeader className="px-6 pb-4 pt-6">
                <CardTitle className="flex items-center gap-2.5">
                  <IndianRupee className="text-primary size-4" />
                  <span className="font-editorial text-foreground text-[20px] font-semibold">
                    Settle your balance
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className={LABEL}>Amount due</span>
                  <span className="numeric text-destructive text-[19px] font-semibold">
                    {formatINRRound(invoice.balanceDue)}
                  </span>
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

          {/* Paid in full */}
          {invoice.status === "PAID" && (
            <Card className="shadow-card border-success/25 bg-success/[0.06] rounded-2xl py-0">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <div className="bg-success/12 flex size-14 items-center justify-center rounded-2xl">
                  <CheckCircle2 className="text-success size-7" />
                </div>
                <h3 className="font-editorial text-foreground mt-4 text-[20px] font-semibold">
                  Paid in full
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Nothing left to settle on this invoice — thank you.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Installment Schedule */}
          {invoice.installments.length > 0 && (
            <Card className="shadow-card rounded-2xl py-0">
              <CardHeader className="px-6 pb-4 pt-6">
                <CardTitle className="font-editorial text-foreground text-[20px] font-semibold">
                  Payment schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-3">
                  {invoice.installments.map((inst, idx) => {
                    const isPaid = inst.status === "COMPLETED";
                    const isOverdue =
                      !isPaid && new Date(inst.dueDate) < new Date();
                    return (
                      <div
                        key={inst.id}
                        className={`rounded-xl border p-3.5 ${
                          isPaid
                            ? "border-success/25 bg-success/[0.06]"
                            : isOverdue
                              ? "border-destructive/25 bg-destructive/[0.06]"
                              : "bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div
                              className={`numeric flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                                isPaid
                                  ? "bg-success/15 text-success"
                                  : isOverdue
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {idx + 1}
                            </div>
                            <span className="text-foreground truncate text-sm font-medium">
                              {inst.label}
                            </span>
                          </div>
                          <span className="numeric text-foreground shrink-0 text-sm font-semibold">
                            {formatINRRound(inst.amount)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 pl-[34px]">
                          <span
                            className={`numeric text-xs ${
                              isOverdue
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            Due {shortDate(inst.dueDate)}
                          </span>
                          {isPaid && (
                            <span className="text-success flex items-center gap-1 text-xs font-medium">
                              <CheckCircle2 className="size-3" />
                              Paid
                              {inst.paidAt && (
                                <span className="numeric">
                                  {new Date(inst.paidAt).toLocaleDateString(
                                    "en-IN",
                                    { month: "short", day: "numeric" }
                                  )}
                                </span>
                              )}
                            </span>
                          )}
                          {isOverdue && (
                            <span className="text-destructive text-xs font-semibold">
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

          {/* At a glance */}
          <Card className="shadow-card rounded-2xl py-0">
            <CardHeader className="px-6 pb-4 pt-6">
              <CardTitle className="font-editorial text-foreground text-[20px] font-semibold">
                At a glance
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="numeric text-foreground font-medium">
                    {invoice.invoiceNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Line items</span>
                  <span className="numeric text-foreground font-medium">
                    {invoice.lineItems.length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    Payments received
                  </span>
                  <span className="numeric text-foreground font-medium">
                    {
                      invoice.payments.filter((p) => p.status === "COMPLETED")
                        .length
                    }
                  </span>
                </div>
                {invoice.sacCode && (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">SAC code</span>
                    <span className="numeric text-foreground font-medium">
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
