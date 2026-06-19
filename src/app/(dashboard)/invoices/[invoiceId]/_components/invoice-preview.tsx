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
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";

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
  const docTitle = fullyPaid ? "TAX INVOICE" : "PROFORMA INVOICE";

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
      <div className="mx-auto max-w-[210mm] rounded-lg border bg-white p-8 shadow-sm print:shadow-none print:border-0 print:p-0">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Veloria Grand</h1>
            <p className="mt-0.5 text-xs font-semibold text-zinc-600">
              {COMPANY_LEGAL_LINE}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Premium Event & Banquet Services
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {COMPANY_ADDRESS}
              <br />
              GSTIN: {COMPANY_GSTIN || "Not Configured"}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <h2 className="text-2xl font-bold text-zinc-900">{docTitle}</h2>
            <p className="mt-1 text-sm font-medium">
              {invoice.invoiceNumber}
            </p>
            <div className="mt-2 space-y-0.5 text-sm text-zinc-600">
              <p>
                <span className="font-medium">Issue Date:</span>{" "}
                {format(new Date(invoice.issueDate), "dd MMM yyyy")}
              </p>
              <p>
                <span className="font-medium">Due Date:</span>{" "}
                {format(new Date(invoice.dueDate), "dd MMM yyyy")}
              </p>
            </div>
            <div className="mt-2">
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
          <div>
            <h3 className="text-xs font-semibold uppercase text-zinc-400 mb-2">
              Bill To
            </h3>
            <p className="font-semibold text-zinc-900">
              {invoice.contact.firstName} {invoice.contact.lastName}
            </p>
            {invoice.contact.company && (
              <p className="text-sm text-zinc-600">{invoice.contact.company}</p>
            )}
            {invoice.contact.address && (
              <p className="text-sm text-zinc-500">
                {invoice.contact.address}
                {invoice.contact.city && `, ${invoice.contact.city}`}
                {invoice.contact.state && `, ${invoice.contact.state}`}
                {invoice.contact.pincode && ` - ${invoice.contact.pincode}`}
              </p>
            )}
            {invoice.contact.email && (
              <p className="text-sm text-zinc-500">{invoice.contact.email}</p>
            )}
            {invoice.contact.phone && (
              <p className="text-sm text-zinc-500">{invoice.contact.phone}</p>
            )}
            {invoice.gstin && (
              <p className="text-sm text-zinc-500 mt-1">
                <span className="font-medium">GSTIN:</span> {invoice.gstin}
              </p>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase text-zinc-400 mb-2">
              Invoice Details
            </h3>
            <div className="space-y-1 text-sm">
              {invoice.placeOfSupply && (
                <p>
                  <span className="text-zinc-500">Place of Supply:</span>{" "}
                  <span className="font-medium">{invoice.placeOfSupply}</span>
                </p>
              )}
              {invoice.sacCode && (
                <p>
                  <span className="text-zinc-500">SAC Code:</span>{" "}
                  <span className="font-medium">{invoice.sacCode}</span>
                </p>
              )}
              {invoice.booking && (
                <>
                  <p>
                    <span className="text-zinc-500">Booking:</span>{" "}
                    <span className="font-medium">
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
                    <span className="font-medium">
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

        {/* Line Items Table */}
        <div className="mt-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-200">
                <th className="pb-2 text-left font-semibold text-zinc-500">
                  #
                </th>
                <th className="pb-2 text-left font-semibold text-zinc-500">
                  Description
                </th>
                {invoice.lineItems[0]?.sacCode && (
                  <th className="pb-2 text-left font-semibold text-zinc-500">
                    SAC
                  </th>
                )}
                <th className="pb-2 text-right font-semibold text-zinc-500">
                  Qty
                </th>
                <th className="pb-2 text-right font-semibold text-zinc-500">
                  Unit Price
                </th>
                <th className="pb-2 text-right font-semibold text-zinc-500">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item, index) => (
                <tr
                  key={item.id}
                  className="border-b border-zinc-100"
                >
                  <td className="py-3 text-zinc-400">{index + 1}</td>
                  <td className="py-3 font-medium">{item.description}</td>
                  {item.sacCode !== undefined && (
                    <td className="py-3 text-zinc-500">
                      {item.sacCode || "--"}
                    </td>
                  )}
                  <td className="py-3 text-right">
                    {toNum(item.quantity)}
                  </td>
                  <td className="py-3 text-right">
                    {formatINR(item.unitPrice)}
                  </td>
                  <td className="py-3 text-right font-medium">
                    {formatINR(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-medium">
                {formatINR(invoice.subtotal)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount ({discountPercent}%)</span>
                <span>-{formatINR(discountAmount)}</span>
              </div>
            )}
            {!isInterstate ? (
              <>
                {cgstAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">CGST ({cgstRate}%)</span>
                    <span>{formatINR(cgstAmount)}</span>
                  </div>
                )}
                {sgstAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">SGST ({sgstRate}%)</span>
                    <span>{formatINR(sgstAmount)}</span>
                  </div>
                )}
              </>
            ) : (
              igstAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">IGST ({igstRate}%)</span>
                  <span>{formatINR(igstAmount)}</span>
                </div>
              )
            )}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatINR(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-green-700">
              <span>Paid</span>
              <span>{formatINR(invoice.paidAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Balance Due</span>
              <span
                className={
                  toNum(invoice.balanceDue) > 0 ? "text-red-600" : "text-green-700"
                }
              >
                {formatINR(invoice.balanceDue)}
              </span>
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
              {`1. To block the slot — 20% on the day of booking.
2. 60% — 15 days before the event.
3. Balance (20%) — 2 hours before the event.

This is a Proforma Invoice for advance/part payment and is not a tax document. A Tax Invoice will be issued once full payment is received.`}
            </p>
          </div>
        )}

        {/* Notes & Terms */}
        {(invoice.notes || invoice.terms) && (
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
            {invoice.terms && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Terms & Conditions
                </h4>
                <p className="text-sm text-zinc-600 whitespace-pre-line">
                  {invoice.terms}
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
          <h3 className="text-lg font-semibold mb-3">Payment History</h3>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-zinc-50">
                  <th className="p-3 text-left font-medium text-zinc-500">
                    Receipt #
                  </th>
                  <th className="p-3 text-left font-medium text-zinc-500">
                    Date
                  </th>
                  <th className="p-3 text-left font-medium text-zinc-500">
                    Method
                  </th>
                  <th className="p-3 text-left font-medium text-zinc-500">
                    Transaction ID
                  </th>
                  <th className="p-3 text-right font-medium text-zinc-500">
                    Amount
                  </th>
                  <th className="p-3 text-left font-medium text-zinc-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      {payment.receiptNumber || "--"}
                    </td>
                    <td className="p-3">
                      {payment.paidAt
                        ? format(new Date(payment.paidAt), "dd MMM yyyy")
                        : format(new Date(payment.createdAt), "dd MMM yyyy")}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {payment.method.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="p-3 text-zinc-500">
                      {payment.transactionId || "--"}
                    </td>
                    <td className="p-3 text-right font-medium text-green-700">
                      {formatINR(payment.amount)}
                    </td>
                    <td className="p-3">
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
      )}

      {/* Installment Schedule - Not printed */}
      {invoice.installments.length > 0 && (
        <div className="print:hidden">
          <h3 className="text-lg font-semibold mb-3">Installment Schedule</h3>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-zinc-50">
                  <th className="p-3 text-left font-medium text-zinc-500">
                    Installment
                  </th>
                  <th className="p-3 text-left font-medium text-zinc-500">
                    Due Date
                  </th>
                  <th className="p-3 text-right font-medium text-zinc-500">
                    Amount
                  </th>
                  <th className="p-3 text-left font-medium text-zinc-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.installments.map((inst) => (
                  <tr key={inst.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{inst.label}</td>
                    <td className="p-3">
                      {format(new Date(inst.dueDate), "dd MMM yyyy")}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatINR(inst.amount)}
                    </td>
                    <td className="p-3">
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
      )}
    </div>
  );
}
