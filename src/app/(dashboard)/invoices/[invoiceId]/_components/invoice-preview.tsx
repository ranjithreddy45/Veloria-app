"use client";

import { format } from "date-fns";
import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  INVOICE_STATUS_COLORS,
  PAYMENT_STATUS_COLORS,
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_LEGAL_LINE,
  LEGACY_INVOICE_TERMS,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { PAYMENT_TERMS_LINES } from "@/lib/sales/quotation-calc";

// ============================================================
// Types
// ============================================================

type InvoiceData = {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: Date | string;
  dueDate: Date | string;
  subtotal: number | string | { toString(): string };
  discountPercent?: number | string | { toString(): string } | null;
  discountAmount?: number | string | { toString(): string } | null;
  cgstRate: number | string | { toString(): string };
  sgstRate: number | string | { toString(): string };
  igstRate: number | string | { toString(): string };
  cgstAmount: number | string | { toString(): string };
  sgstAmount: number | string | { toString(): string };
  igstAmount: number | string | { toString(): string };
  totalAmount: number | string | { toString(): string };
  paidAmount: number | string | { toString(): string };
  balanceDue: number | string | { toString(): string };
  notes?: string | null;
  terms?: string | null;
  gstin?: string | null;
  placeOfSupply?: string | null;
  sacCode?: string | null;
  contact: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  };
  booking?: {
    bookingNumber: string;
    eventName: string;
    eventType: string;
    date: Date | string;
    venue?: { name: string } | null;
  } | null;
  lineItems: {
    id: string;
    description: string;
    quantity: number | string | { toString(): string };
    unitPrice: number | string | { toString(): string };
    amount: number | string | { toString(): string };
    sacCode?: string | null;
  }[];
  payments: {
    id: string;
    amount: number | string | { toString(): string };
    status: string;
    method: string;
    transactionId?: string | null;
    receiptNumber?: string | null;
    paidAt?: Date | string | null;
    createdAt: Date | string;
  }[];
  installments: {
    id: string;
    label: string;
    amount: number | string | { toString(): string };
    dueDate: Date | string;
    status: string;
  }[];
  createdBy: {
    name?: string | null;
  };
};

// ============================================================
// Format Helpers
// ============================================================

function toNum(
  val: number | string | { toString(): string } | null | undefined
): number {
  if (val === null || val === undefined) return 0;
  return Number(val.toString());
}

function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

// ============================================================
// Invoice Preview Component
// ============================================================

interface InvoicePreviewProps {
  invoice: InvoiceData;
}

export function InvoicePreview({ invoice }: InvoicePreviewProps) {
  const handlePrint = () => {
    window.print();
  };

  const discountPercent = toNum(invoice.discountPercent);
  const discountAmount = toNum(invoice.discountAmount);
  const cgstRate = toNum(invoice.cgstRate);
  const sgstRate = toNum(invoice.sgstRate);
  const igstRate = toNum(invoice.igstRate);
  const cgstAmount = toNum(invoice.cgstAmount);
  const sgstAmount = toNum(invoice.sgstAmount);
  const igstAmount = toNum(invoice.igstAmount);
  const isInterstate = igstRate > 0;
  // Proforma until paid in full; Tax Invoice only on 100% payment.
  const fullyPaid = toNum(invoice.balanceDue) <= 0 || invoice.status === "PAID";
  // Goal-gradient collection progress (derived — no new data).
  const totalNum = toNum(invoice.totalAmount);
  const paidNum = toNum(invoice.paidAmount);
  const balanceNum = Math.max(0, toNum(invoice.balanceDue));
  const paidPct = fullyPaid
    ? 100
    : totalNum > 0
      ? Math.min(99, Math.max(0, Math.round((paidNum / totalNum) * 100)))
      : 0;
  const almostThere = !fullyPaid && paidPct >= 80;
  const docTitle = fullyPaid ? "TAX INVOICE" : "PROFORMA INVOICE";
  // Drop the retired default T&C boilerplate from old invoices; keep custom terms.
  const customTerms =
    invoice.terms && invoice.terms.trim() !== LEGACY_INVOICE_TERMS.trim()
      ? invoice.terms
      : null;

  return (
    <div className="space-y-6">
      {/* Print Button */}
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <PrinterIcon className="mr-2 size-4" />
          Print Invoice
        </Button>
      </div>

      {/* A4 Invoice Container */}
      {/* p-8 leaves only ~311px of usable width on a 375px phone once the page
          gutters are counted, which is what crushed the line-item table. */}
      <div className="mx-auto max-w-[210mm] rounded-2xl border bg-white p-4 text-zinc-900 shadow-card sm:p-8 print:shadow-none print:border-0 print:p-0 print:rounded-none">
        {/* Header — issuer block (left) vs document block (right) */}
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <div className="font-editorial text-[30px] font-semibold leading-tight text-zinc-900">
              Veloria Grand
            </div>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              {COMPANY_LEGAL_LINE}
            </p>
            <p className="mt-1.5 text-[13px] text-zinc-500">
              Premium Event &amp; Banquet Services
            </p>
            <p className="mt-2.5 text-[12px] leading-relaxed text-zinc-500">
              {COMPANY_ADDRESS}
              <br />
              GSTIN: <span className="numeric">{COMPANY_GSTIN || "Not Configured"}</span>
            </p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              {docTitle}
            </h2>
            <p className="numeric mt-1.5 text-[20px] font-semibold text-zinc-900">
              {invoice.invoiceNumber}
            </p>
            <div className="mt-3 space-y-1 text-[12.5px] text-zinc-600">
              <p className="sm:flex sm:justify-end sm:gap-3">
                <span className="text-zinc-400">Issue date</span>
                <span className="numeric">
                  {format(new Date(invoice.issueDate), "dd MMM yyyy")}
                </span>
              </p>
              <p className="sm:flex sm:justify-end sm:gap-3">
                <span className="text-zinc-400">Due date</span>
                <span className="numeric">
                  {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                </span>
              </p>
            </div>
            <div className="mt-3">
              <Badge
                variant="outline"
                className={`${INVOICE_STATUS_COLORS[invoice.status] || ""} border print:border`}
              >
                {invoice.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Bill To & Invoice Details */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-xl bg-zinc-50/80 p-4 print:bg-transparent print:p-0">
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Bill To
            </h3>
            <p className="text-[15px] font-semibold text-zinc-900">
              {invoice.contact.firstName} {invoice.contact.lastName}
            </p>
            {invoice.contact.company && (
              <p className="text-[13px] text-zinc-600">{invoice.contact.company}</p>
            )}
            {invoice.contact.address && (
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                {invoice.contact.address}
                {invoice.contact.city && `, ${invoice.contact.city}`}
                {invoice.contact.state && `, ${invoice.contact.state}`}
                {invoice.contact.pincode && ` - ${invoice.contact.pincode}`}
              </p>
            )}
            {invoice.contact.email && (
              // break-all: a long address is one unbreakable token and would
              // otherwise widen the whole invoice sheet past the viewport.
              <p className="break-all text-[13px] text-zinc-500">{invoice.contact.email}</p>
            )}
            {invoice.contact.phone && (
              <p className="numeric text-[13px] text-zinc-500">
                {invoice.contact.phone}
              </p>
            )}
            {invoice.gstin && (
              <p className="mt-1 text-[13px] text-zinc-500">
                <span className="font-medium">GSTIN:</span>{" "}
                <span className="numeric">{invoice.gstin}</span>
              </p>
            )}
          </div>
          <div className="rounded-xl bg-zinc-50/80 p-4 print:bg-transparent print:p-0">
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Invoice Details
            </h3>
            <div className="space-y-1 text-[13px]">
              {invoice.placeOfSupply && (
                <p>
                  <span className="text-zinc-500">Place of Supply:</span>{" "}
                  <span className="font-medium">{invoice.placeOfSupply}</span>
                </p>
              )}
              {invoice.sacCode && (
                <p>
                  <span className="text-zinc-500">SAC Code:</span>{" "}
                  <span className="numeric font-medium">{invoice.sacCode}</span>
                </p>
              )}
              {invoice.booking && (
                <>
                  <p>
                    <span className="text-zinc-500">Booking:</span>{" "}
                    <span className="numeric font-medium">
                      {invoice.booking.bookingNumber}
                    </span>
                  </p>
                  <p>
                    <span className="text-zinc-500">Event:</span>{" "}
                    <span className="font-medium">
                      {invoice.booking.eventName} ({invoice.booking.eventType})
                    </span>
                  </p>
                  <p>
                    <span className="text-zinc-500">Date:</span>{" "}
                    <span className="numeric font-medium">
                      {format(new Date(invoice.booking.date), "dd MMM yyyy")}
                    </span>
                  </p>
                  {invoice.booking.venue && (
                    <p>
                      <span className="text-zinc-500">Venue:</span>{" "}
                      <span className="font-medium">
                        {invoice.booking.venue.name}
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Line Items — six columns cannot fit 375px without a sideways scroll,
            and an invoice line you have to drag to read is the worst case on
            this screen. Below `sm` each line becomes a stacked card; the table
            is what still prints. */}
        <ul className="mt-6 space-y-2.5 sm:hidden print:hidden">
          {invoice.lineItems.map((item, index) => (
            <li
              key={item.id}
              className="rounded-xl border border-zinc-200 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[13px] font-medium text-zinc-800">
                  <span className="numeric text-zinc-400">{index + 1}.</span>{" "}
                  {item.description}
                </p>
                <p className="numeric shrink-0 text-[13px] font-semibold text-zinc-900">
                  {formatINR(item.amount)}
                </p>
              </div>
              <p className="numeric mt-1 text-[12px] text-zinc-500">
                {toNum(item.quantity)} × {formatINR(item.unitPrice)}
                {item.sacCode ? ` · SAC ${item.sacCode}` : ""}
              </p>
            </li>
          ))}
        </ul>

        {/* Line Items Table */}
        <div className="mt-8 hidden overflow-x-auto sm:block print:block">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-zinc-300">
                <th className="w-8 pb-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  #
                </th>
                <th className="pb-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  Description
                </th>
                {invoice.lineItems[0]?.sacCode && (
                  <th className="pb-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                    SAC
                  </th>
                )}
                <th className="w-16 pb-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  Qty
                </th>
                <th className="w-32 pb-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  Unit Price
                </th>
                <th className="w-36 pb-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item, index) => (
                <tr key={item.id} className="border-b border-zinc-100">
                  <td className="numeric py-3 text-zinc-400">{index + 1}</td>
                  <td className="py-3 pr-4 font-medium text-zinc-800">
                    {item.description}
                  </td>
                  {item.sacCode !== undefined && (
                    <td className="numeric py-3 text-zinc-500">
                      {item.sacCode || "—"}
                    </td>
                  )}
                  <td className="numeric py-3 text-right text-zinc-600">
                    {toNum(item.quantity)}
                  </td>
                  <td className="numeric py-3 text-right text-zinc-600">
                    {formatINR(item.unitPrice)}
                  </td>
                  <td className="numeric py-3 text-right font-semibold text-zinc-900">
                    {formatINR(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-[13px] print:border-0 print:bg-transparent print:p-0">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-zinc-500">Subtotal</span>
                <span className="numeric font-medium text-zinc-900">
                  {formatINR(invoice.subtotal)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex items-baseline justify-between gap-4 text-red-600">
                  <span>
                    Discount (<span className="numeric">{discountPercent}</span>%)
                  </span>
                  <span className="numeric">-{formatINR(discountAmount)}</span>
                </div>
              )}
              {!isInterstate ? (
                <>
                  {cgstAmount > 0 && (
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-zinc-500">
                        CGST (<span className="numeric">{cgstRate}</span>%)
                      </span>
                      <span className="numeric text-zinc-700">
                        {formatINR(cgstAmount)}
                      </span>
                    </div>
                  )}
                  {sgstAmount > 0 && (
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-zinc-500">
                        SGST (<span className="numeric">{sgstRate}</span>%)
                      </span>
                      <span className="numeric text-zinc-700">
                        {formatINR(sgstAmount)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                igstAmount > 0 && (
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-zinc-500">
                      IGST (<span className="numeric">{igstRate}</span>%)
                    </span>
                    <span className="numeric text-zinc-700">
                      {formatINR(igstAmount)}
                    </span>
                  </div>
                )
              )}
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-zinc-300 pt-3 text-[15px] font-semibold">
              <span className="text-zinc-900">Total</span>
              <span className="numeric text-zinc-900">
                {formatINR(invoice.totalAmount)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4 text-green-700">
              <span>Paid</span>
              <span className="numeric">{formatINR(invoice.paidAmount)}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-zinc-200 pt-2.5 text-[17px] font-bold">
              <span className="text-zinc-900">Balance Due</span>
              <span
                className={
                  toNum(invoice.balanceDue) > 0
                    ? "numeric text-red-600"
                    : "numeric text-green-700"
                }
              >
                {formatINR(invoice.balanceDue)}
              </span>
            </div>

            {/* Goal-gradient: collection progress (screen only, not printed) */}
            <div className="pt-3 print:hidden">
              <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                <span>Collection progress</span>
                <span className="numeric tracking-normal">{paidPct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/70">
                <div
                  className={`h-full rounded-full transition-all ${
                    fullyPaid ? "bg-emerald-500" : "bg-violet-500"
                  }`}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              {fullyPaid ? (
                <p className="mt-2 text-[12px] font-medium text-emerald-600">
                  Fully paid
                </p>
              ) : almostThere ? (
                <p className="mt-2 text-[12px] font-medium text-amber-600">
                  Almost there —{" "}
                  <span className="numeric text-emerald-700">
                    {inr(balanceNum)}
                  </span>{" "}
                  to go
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-zinc-500">
                  <span className="numeric font-semibold text-zinc-700">
                    {inr(balanceNum)}
                  </span>{" "}
                  away from fully paid
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payment terms — shown on the Proforma until full payment is received */}
        {!fullyPaid && (
          <div className="mt-8 space-y-2">
            <Separator />
            <h4 className="text-xs font-semibold uppercase text-zinc-400 mb-1">
              Payment Terms
            </h4>
            <p className="text-sm text-zinc-600 whitespace-pre-line">
              {`${PAYMENT_TERMS_LINES.join("\n")}

This is a Proforma Invoice for advance/part payment and is not a tax document. A Tax Invoice will be issued once full payment is received.`}
            </p>
          </div>
        )}

        {/* Notes & Terms */}
        {(invoice.notes || customTerms) && (
          <div className="mt-8 space-y-4">
            <Separator />
            {invoice.notes && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Notes
                </h4>
                <p className="text-sm text-zinc-600 whitespace-pre-line">
                  {invoice.notes}
                </p>
              </div>
            )}
            {customTerms && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Terms & Conditions
                </h4>
                <p className="text-sm text-zinc-600 whitespace-pre-line">
                  {customTerms}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t pt-4">
          <p className="text-center text-xs text-zinc-400">
            This is a computer-generated invoice and does not require a physical
            signature.
          </p>
        </div>
      </div>

      {/* Payment History - Not printed */}
      {invoice.payments.length > 0 && (
        <div className="print:hidden">
          <h3 className="mb-3">Payment History</h3>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            {/* Six columns need a sideways drag on a phone; stack them instead. */}
            <ul className="divide-y sm:hidden">
              {invoice.payments.map((payment) => (
                <li key={payment.id} className="space-y-1.5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="numeric min-w-0 text-[13px] font-medium">
                      {payment.receiptNumber || "—"}
                    </span>
                    <span className="numeric shrink-0 text-[13px] font-semibold text-success">
                      {formatINR(payment.amount)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span className="numeric">
                      {payment.paidAt
                        ? format(new Date(payment.paidAt), "dd MMM yyyy")
                        : format(new Date(payment.createdAt), "dd MMM yyyy")}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {payment.method.replace("_", " ")}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`${PAYMENT_STATUS_COLORS[payment.status] || ""} border text-xs`}
                    >
                      {payment.status}
                    </Badge>
                  </div>
                  {payment.transactionId && (
                    <p className="numeric break-all text-[12px] text-muted-foreground">
                      Txn {payment.transactionId}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/30 text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                    <th className="px-3 py-2.5 text-left">Receipt #</th>
                    <th className="px-3 py-2.5 text-left">Date</th>
                    <th className="px-3 py-2.5 text-left">Method</th>
                    <th className="px-3 py-2.5 text-left">Transaction ID</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="numeric px-3 py-2.5 font-medium">
                        {payment.receiptNumber || "—"}
                      </td>
                      <td className="numeric px-3 py-2.5 text-muted-foreground">
                        {payment.paidAt
                          ? format(new Date(payment.paidAt), "dd MMM yyyy")
                          : format(new Date(payment.createdAt), "dd MMM yyyy")}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="text-xs">
                          {payment.method.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="numeric px-3 py-2.5 text-muted-foreground">
                        {payment.transactionId || "—"}
                      </td>
                      <td className="numeric px-3 py-2.5 text-right font-semibold text-success">
                        {formatINR(payment.amount)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant="outline"
                          className={`${PAYMENT_STATUS_COLORS[payment.status] || ""} border text-xs`}
                        >
                          {payment.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Installment Schedule - Not printed */}
      {invoice.installments.length > 0 && (
        <div className="print:hidden">
          <h3 className="mb-3">Installment Schedule</h3>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            {/* Same reasoning as the payment history: stacked rows on a phone. */}
            <ul className="divide-y sm:hidden">
              {invoice.installments.map((inst) => (
                <li key={inst.id} className="space-y-1.5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-[13px] font-medium">
                      {inst.label}
                    </span>
                    <span className="numeric shrink-0 text-[13px] font-semibold">
                      {formatINR(inst.amount)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span className="numeric">
                      Due {format(new Date(inst.dueDate), "dd MMM yyyy")}
                    </span>
                    <Badge
                      variant="outline"
                      className={`${PAYMENT_STATUS_COLORS[inst.status] || ""} border text-xs`}
                    >
                      {inst.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/30 text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                    <th className="px-3 py-2.5 text-left">Installment</th>
                    <th className="px-3 py-2.5 text-left">Due Date</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.installments.map((inst) => (
                    <tr
                      key={inst.id}
                      className="border-b transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2.5 font-medium">{inst.label}</td>
                      <td className="numeric px-3 py-2.5 text-muted-foreground">
                        {format(new Date(inst.dueDate), "dd MMM yyyy")}
                      </td>
                      <td className="numeric px-3 py-2.5 text-right font-semibold">
                        {formatINR(inst.amount)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant="outline"
                          className={`${PAYMENT_STATUS_COLORS[inst.status] || ""} border text-xs`}
                        >
                          {inst.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
