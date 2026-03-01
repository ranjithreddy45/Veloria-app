"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  SendIcon,
  PencilIcon,
  ArrowRightLeftIcon,
  PrinterIcon,
  FileTextIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { QUOTE_STATUS_COLORS, COMPANY_ADDRESS, COMPANY_GSTIN } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { sendQuote, convertToInvoice } from "@/actions/quote.actions";

// ============================================================
// Types
// ============================================================

type QuoteData = {
  id: string;
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
  sentAt?: Date | string | null;
  viewedAt?: Date | string | null;
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
    id: string;
    title: string;
    status: string;
  } | null;
  package?: {
    id: string;
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
  convertedInvoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
  } | null;
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
// Quote Detail Component
// ============================================================

interface QuoteDetailProps {
  quote: QuoteData;
}

export function QuoteDetail({ quote }: QuoteDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const discountPercent = toNum(quote.discountPercent);
  const discountAmount = toNum(quote.discountAmount);
  const taxRate = toNum(quote.taxRate);
  const taxAmount = toNum(quote.taxAmount);

  const handlePrint = () => {
    window.print();
  };

  const handleSend = () => {
    startTransition(async () => {
      const result = await sendQuote(quote.id);
      if (result.success) {
        toast.success("Quote sent successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to send quote");
      }
    });
  };

  const handleConvert = () => {
    if (!confirm("Convert this quote to an invoice? This action cannot be undone.")) return;
    startTransition(async () => {
      const result = await convertToInvoice(quote.id);
      if (result.success && result.data) {
        toast.success(`Quote converted to Invoice ${result.data.invoiceNumber}`);
        router.push(`/invoices/${result.data.invoiceId}`);
      } else {
        toast.error(result.error || "Failed to convert quote");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <PrinterIcon className="mr-2 size-4" />
          Print Quote
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            window.open(`/quotes/${quote.id}/pdf?auto=1`, "_blank")
          }
        >
          <FileTextIcon className="mr-2 size-4" />
          Download PDF
        </Button>
        {quote.status === "DRAFT" && (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/quotes/${quote.id}/edit`}>
                <PencilIcon className="mr-2 size-4" />
                Edit
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={isPending}
            >
              <SendIcon className="mr-2 size-4" />
              {isPending ? "Sending..." : "Send Quote"}
            </Button>
          </>
        )}
        {(quote.status === "SENT" ||
          quote.status === "VIEWED" ||
          quote.status === "ACCEPTED") &&
          !quote.convertedInvoice && (
            <Button
              size="sm"
              variant="default"
              onClick={handleConvert}
              disabled={isPending}
            >
              <ArrowRightLeftIcon className="mr-2 size-4" />
              {isPending ? "Converting..." : "Convert to Invoice"}
            </Button>
          )}
      </div>

      {/* Converted Invoice Link */}
      {quote.convertedInvoice && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800 p-4 print:hidden">
          <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
            This quote has been converted to{" "}
            <Link
              href={`/invoices/${quote.convertedInvoice.id}`}
              className="underline font-semibold"
            >
              Invoice {quote.convertedInvoice.invoiceNumber}
            </Link>
          </p>
        </div>
      )}

      {/* A4 Quote Container */}
      <div className="mx-auto max-w-[210mm] rounded-lg border bg-white dark:bg-zinc-950 p-8 shadow-sm print:shadow-none print:border-0 print:p-0">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Veloria Grand
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Premium Event & Banquet Services
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {COMPANY_ADDRESS}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              QUOTATION
            </h2>
            <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {quote.quoteNumber}
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {quote.title}
            </p>
            <div className="mt-2 space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
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
              <Badge
                variant="outline"
                className={`${QUOTE_STATUS_COLORS[quote.status] || ""} border print:border`}
              >
                {quote.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Prepared For & Quote Details */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase text-zinc-400 dark:text-zinc-500 mb-2">
              Prepared For
            </h3>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {quote.contact.firstName} {quote.contact.lastName}
            </p>
            {quote.contact.company && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {quote.contact.company}
              </p>
            )}
            {quote.contact.address && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {quote.contact.address}
                {quote.contact.city && `, ${quote.contact.city}`}
                {quote.contact.state && `, ${quote.contact.state}`}
                {quote.contact.pincode && ` - ${quote.contact.pincode}`}
              </p>
            )}
            {quote.contact.email && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {quote.contact.email}
              </p>
            )}
            {quote.contact.phone && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {quote.contact.phone}
              </p>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase text-zinc-400 dark:text-zinc-500 mb-2">
              Quote Details
            </h3>
            <div className="space-y-1 text-sm">
              {quote.lead && (
                <p>
                  <span className="text-zinc-500 dark:text-zinc-400">Lead:</span>{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {quote.lead.title}
                  </span>
                </p>
              )}
              {quote.package && (
                <p>
                  <span className="text-zinc-500 dark:text-zinc-400">Package:</span>{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {quote.package.name}
                  </span>
                </p>
              )}
              {quote.sentAt && (
                <p>
                  <span className="text-zinc-500 dark:text-zinc-400">Sent:</span>{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {format(new Date(quote.sentAt), "dd MMM yyyy, h:mm a")}
                  </span>
                </p>
              )}
              {quote.viewedAt && (
                <p>
                  <span className="text-zinc-500 dark:text-zinc-400">Viewed:</span>{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {format(new Date(quote.viewedAt), "dd MMM yyyy, h:mm a")}
                  </span>
                </p>
              )}
              <p>
                <span className="text-zinc-500 dark:text-zinc-400">Created by:</span>{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {quote.createdBy.name || "Unknown"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Cover Letter */}
        {quote.coverLetter && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase text-zinc-400 dark:text-zinc-500 mb-2">
              Cover Letter
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-line">
              {quote.coverLetter}
            </p>
          </div>
        )}

        {/* Line Items Table */}
        <div className="mt-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-200 dark:border-zinc-700">
                <th className="pb-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                  #
                </th>
                <th className="pb-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                  Description
                </th>
                <th className="pb-2 text-left font-semibold text-zinc-500 dark:text-zinc-400">
                  Category
                </th>
                <th className="pb-2 text-right font-semibold text-zinc-500 dark:text-zinc-400">
                  Qty
                </th>
                <th className="pb-2 text-right font-semibold text-zinc-500 dark:text-zinc-400">
                  Unit Price
                </th>
                <th className="pb-2 text-right font-semibold text-zinc-500 dark:text-zinc-400">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {quote.lineItems.map((item, index) => (
                <tr
                  key={item.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-3 text-zinc-400 dark:text-zinc-500">
                    {index + 1}
                  </td>
                  <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {item.description}
                  </td>
                  <td className="py-3 text-zinc-500 dark:text-zinc-400">
                    {item.category || "--"}
                  </td>
                  <td className="py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {toNum(item.quantity)}
                  </td>
                  <td className="py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {formatINR(item.unitPrice)}
                  </td>
                  <td className="py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
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
              <span className="text-zinc-500 dark:text-zinc-400">Subtotal</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatINR(quote.subtotal)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount ({discountPercent}%)</span>
                <span>-{formatINR(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Tax ({taxRate}%)
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {formatINR(taxAmount)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span className="text-zinc-900 dark:text-zinc-100">Total</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                {formatINR(quote.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(quote.notes || quote.terms) && (
          <div className="mt-8 space-y-4">
            <Separator />
            {quote.notes && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-zinc-400 dark:text-zinc-500 mb-1">
                  Notes
                </h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-line">
                  {quote.notes}
                </p>
              </div>
            )}
            {quote.terms && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-zinc-400 dark:text-zinc-500 mb-1">
                  Terms & Conditions
                </h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-line">
                  {quote.terms}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t pt-4 dark:border-zinc-800">
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
            This is a computer-generated quotation and does not require a
            physical signature.
          </p>
        </div>
      </div>
    </div>
  );
}
