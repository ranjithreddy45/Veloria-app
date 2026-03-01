"use client";

import { format } from "date-fns";
import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { COMPANY_ADDRESS, COMPANY_GSTIN } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

type QuotePdfData = {
  quoteNumber: string;
  title: string;
  status: string;
  validUntil: Date | string;
  subtotal: number | string | { toString(): string };
  discountPercent?: number | string | { toString(): string } | null;
  discountAmount?: number | string | { toString(): string } | null;
  taxRate: number | string | { toString(): string };
  taxAmount: number | string | { toString(): string };
  totalAmount: number | string | { toString(): string };
  notes?: string | null;
  terms?: string | null;
  coverLetter?: string | null;
  createdAt: Date | string;
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
  lead?: {
    title: string;
  } | null;
  package?: {
    name: string;
  } | null;
  lineItems: {
    id: string;
    description: string;
    quantity: number | string | { toString(): string };
    unitPrice: number | string | { toString(): string };
    amount: number | string | { toString(): string };
    category?: string | null;
  }[];
  createdBy: {
    name?: string | null;
  };
};

function toNum(
  val: number | string | { toString(): string } | null | undefined
): number {
  if (val === null || val === undefined) return 0;
  return Number(val.toString());
}

// ============================================================
// Quote PDF Component
// ============================================================

interface QuotePdfProps {
  quote: QuotePdfData;
}

export function QuotePdf({ quote }: QuotePdfProps) {
  const discountPercent = toNum(quote.discountPercent);
  const discountAmount = toNum(quote.discountAmount);
  const taxRate = toNum(quote.taxRate);
  const taxAmount = toNum(quote.taxAmount);

  return (
    <div className="bg-white print:bg-white">
      {/* Print Button - hidden when printing */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-indigo-600 px-6 py-3 text-white print:hidden">
        <span className="text-sm font-medium">
          Quotation {quote.quoteNumber} — Ready to save as PDF
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.print()}
          className="bg-white text-indigo-600 hover:bg-indigo-50"
        >
          <PrinterIcon className="mr-2 size-4" />
          Save as PDF / Print
        </Button>
      </div>

      {/* A4 Content */}
      <div
        className="mx-auto max-w-[210mm] bg-white px-10 pb-10 pt-16 text-zinc-900 print:px-0 print:pt-0"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Veloria Grand</h1>
            <p className="mt-1 text-xs text-zinc-500">
              Premium Event & Banquet Services
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {COMPANY_ADDRESS}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-zinc-900">QUOTATION</h2>
            <p className="mt-1 text-sm font-medium">{quote.quoteNumber}</p>
            <p className="text-sm text-zinc-600">{quote.title}</p>
            <div className="mt-2 text-xs text-zinc-600 space-y-0.5">
              <p>
                <span className="font-medium">Date:</span>{" "}
                {format(new Date(quote.createdAt), "dd MMM yyyy")}
              </p>
              <p>
                <span className="font-medium">Valid Until:</span>{" "}
                {format(new Date(quote.validUntil), "dd MMM yyyy")}
              </p>
            </div>
            <div className="mt-2">
              {/* Intentional: using gray-* and fixed colors for PDF/print rendering — no dark mode needed */}
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider
                  ${quote.status === "DRAFT" ? "bg-gray-100 text-gray-600" : ""}
                  ${quote.status === "SENT" ? "bg-blue-100 text-blue-700" : ""}
                  ${quote.status === "VIEWED" ? "bg-cyan-100 text-cyan-700" : ""}
                  ${quote.status === "ACCEPTED" ? "bg-green-100 text-green-700" : ""}
                  ${quote.status === "REJECTED" ? "bg-red-100 text-red-700" : ""}
                  ${quote.status === "EXPIRED" ? "bg-gray-100 text-gray-500" : ""}
                  ${quote.status === "CONVERTED" ? "bg-purple-100 text-purple-700" : ""}
                `}
              >
                {quote.status}
              </span>
            </div>
          </div>
        </div>

        <hr className="my-6 border-zinc-200" />

        {/* Prepared For & Details */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Prepared For
            </p>
            <p className="text-sm font-semibold">
              {quote.contact.firstName} {quote.contact.lastName}
            </p>
            {quote.contact.company && (
              <p className="text-xs text-zinc-600">{quote.contact.company}</p>
            )}
            {quote.contact.address && (
              <p className="text-xs text-zinc-500">
                {quote.contact.address}
                {quote.contact.city && `, ${quote.contact.city}`}
                {quote.contact.state && `, ${quote.contact.state}`}
                {quote.contact.pincode && ` - ${quote.contact.pincode}`}
              </p>
            )}
            {quote.contact.email && (
              <p className="text-xs text-zinc-500">{quote.contact.email}</p>
            )}
            {quote.contact.phone && (
              <p className="text-xs text-zinc-500">{quote.contact.phone}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Quote Details
            </p>
            <div className="space-y-1 text-xs">
              {quote.lead && (
                <p>
                  <span className="text-zinc-500">Lead:</span>{" "}
                  <span className="font-medium">{quote.lead.title}</span>
                </p>
              )}
              {quote.package && (
                <p>
                  <span className="text-zinc-500">Package:</span>{" "}
                  <span className="font-medium">{quote.package.name}</span>
                </p>
              )}
              <p>
                <span className="text-zinc-500">Prepared by:</span>{" "}
                <span className="font-medium">
                  {quote.createdBy.name || "Unknown"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Cover Letter */}
        {quote.coverLetter && (
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Cover Letter
            </p>
            <p className="text-xs text-zinc-600 whitespace-pre-line">
              {quote.coverLetter}
            </p>
          </div>
        )}

        {/* Line Items Table */}
        <table className="w-full mt-6 text-sm">
          <thead>
            <tr className="border-b-2 border-zinc-200">
              <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                #
              </th>
              <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Description
              </th>
              <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Category
              </th>
              <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Qty
              </th>
              <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Unit Price
              </th>
              <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {quote.lineItems.map((item, index) => (
              <tr key={item.id} className="border-b border-zinc-100">
                <td className="py-2.5 text-xs text-zinc-400">{index + 1}</td>
                <td className="py-2.5 text-xs font-medium">{item.description}</td>
                <td className="py-2.5 text-xs text-zinc-500">
                  {item.category || "--"}
                </td>
                <td className="py-2.5 text-xs text-right">
                  {toNum(item.quantity)}
                </td>
                <td className="py-2.5 text-xs text-right">
                  {formatINR(item.unitPrice)}
                </td>
                <td className="py-2.5 text-xs text-right font-medium">
                  {formatINR(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-medium">{formatINR(quote.subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-xs text-red-600">
                <span>Discount ({discountPercent}%)</span>
                <span>-{formatINR(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Tax ({taxRate}%)</span>
                <span>{formatINR(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-zinc-200 pt-2 text-sm font-bold">
              <span>Total</span>
              <span>{formatINR(quote.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(quote.notes || quote.terms) && (
          <div className="mt-8 border-t border-zinc-200 pt-4 space-y-3">
            {quote.notes && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Notes
                </h4>
                <p className="text-xs text-zinc-600 whitespace-pre-line">
                  {quote.notes}
                </p>
              </div>
            )}
            {quote.terms && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Terms & Conditions
                </h4>
                <p className="text-xs text-zinc-600 whitespace-pre-line">
                  {quote.terms}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-zinc-200 pt-3 text-center">
          <p className="text-[11px] text-zinc-400">
            This is a computer-generated quotation and does not require a
            physical signature.
          </p>
        </div>
      </div>
    </div>
  );
}
