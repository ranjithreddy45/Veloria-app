import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  ArrowUpRight,
  CreditCard,
  FileX,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/../auth";
import { getPortalInvoices } from "@/actions/portal.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { INVOICE_STATUS_COLORS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "My Invoices" };

// ============================================================
// Invoices List Page
// ============================================================

export default async function PortalInvoicesPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const invoices = await getPortalInvoices(session.user.id);

  const unpaidInvoices = invoices.filter(
    (inv) => inv.status === "SENT" || inv.status === "PARTIALLY_PAID" || inv.status === "OVERDUE"
  );
  const otherInvoices = invoices.filter(
    (inv) => inv.status !== "SENT" && inv.status !== "PARTIALLY_PAID" && inv.status !== "OVERDUE"
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Invoices"
        description="View and pay your invoices."
      />

      {invoices.length === 0 ? (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-zinc-100">
              <FileX className="size-8 text-zinc-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-900">
              No invoices yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              Your invoices will appear here once generated.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Action Required */}
          {unpaidInvoices.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Action Required ({unpaidInvoices.length})
              </h2>
              <div className="space-y-3">
                {unpaidInvoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} showPayButton />
                ))}
              </div>
            </div>
          )}

          {/* Other Invoices */}
          {otherInvoices.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                {unpaidInvoices.length > 0 ? "Other Invoices" : "All Invoices"} ({otherInvoices.length})
              </h2>
              <div className="space-y-3">
                {otherInvoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Invoice Row Component
// ============================================================

interface InvoiceRowProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    issueDate: Date | string;
    dueDate: Date | string;
    totalAmount: number;
    paidAmount: number;
    balanceDue: number;
    eventName: string | null;
    bookingNumber: string | null;
  };
  showPayButton?: boolean;
}

function InvoiceRow({ invoice, showPayButton }: InvoiceRowProps) {
  const isOverdue = invoice.status === "OVERDUE";
  const dueDate = new Date(invoice.dueDate);
  const issueDate = new Date(invoice.issueDate);

  return (
    <Link href={`/portal/invoices/${invoice.id}`} className="block">
      <Card
        className={`group border-zinc-200/80 shadow-sm transition-all duration-200 hover:shadow-md ${
          isOverdue
            ? "hover:border-red-200 border-red-100"
            : "hover:border-indigo-200"
        }`}
      >
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5">
            {/* Icon + Invoice Info */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div
                className={`flex size-10 items-center justify-center rounded-lg flex-shrink-0 ${
                  isOverdue ? "bg-red-50" : "bg-indigo-50"
                }`}
              >
                <FileText
                  className={`size-5 ${
                    isOverdue ? "text-red-500" : "text-indigo-500"
                  }`}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-900">
                    {invoice.invoiceNumber}
                  </p>
                  <StatusBadge
                    status={invoice.status}
                    colorMap={INVOICE_STATUS_COLORS}
                    className="text-[10px]"
                  />
                </div>
                <p className="mt-0.5 text-xs text-zinc-500 truncate">
                  {invoice.eventName && (
                    <>
                      {invoice.eventName}
                      {" "}&middot;{" "}
                    </>
                  )}
                  Issued{" "}
                  {issueDate.toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Amounts */}
            <div className="flex items-center gap-6 sm:gap-8">
              <div className="text-right">
                <p className="text-xs text-zinc-400">Total</p>
                <p className="text-sm font-semibold text-zinc-900">
                  {formatINR(invoice.totalAmount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400">Paid</p>
                <p className="text-sm font-medium text-emerald-600">
                  {formatINR(invoice.paidAmount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400">Balance</p>
                <p
                  className={`text-sm font-bold ${
                    invoice.balanceDue > 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {formatINR(invoice.balanceDue)}
                </p>
              </div>

              {/* Pay Button or Arrow */}
              {showPayButton && invoice.balanceDue > 0 ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors group-hover:bg-indigo-700">
                  <CreditCard className="size-3.5" />
                  Pay Now
                </span>
              ) : (
                <ArrowUpRight className="size-4 text-zinc-300 flex-shrink-0 transition-colors group-hover:text-indigo-500" />
              )}
            </div>
          </div>

          {/* Due Date Footer */}
          <div
            className={`flex items-center justify-between border-t px-5 py-2 text-xs ${
              isOverdue
                ? "border-red-100 bg-red-50/50 text-red-600"
                : "border-zinc-100 text-zinc-400"
            }`}
          >
            <span>
              Due:{" "}
              {dueDate.toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {isOverdue && (
              <span className="font-semibold">Overdue</span>
            )}
            {/* Mobile Pay Button */}
            {showPayButton && invoice.balanceDue > 0 && (
              <span className="inline-flex sm:hidden items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
                <CreditCard className="size-3" />
                Pay Now
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
