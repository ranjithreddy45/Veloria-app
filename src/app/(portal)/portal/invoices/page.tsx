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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Your account"
        title="My Invoices"
        description="A clear record of what's been billed, paid and still due."
      />

      {invoices.length === 0 ? (
        <Card className="shadow-card rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
              <FileX className="text-muted-foreground/60 size-8" />
            </div>
            <h3 className="font-editorial text-foreground mt-5 text-xl font-semibold">
              Nothing due right now
            </h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              Invoices appear here as soon as they&apos;re issued, with a simple
              way to settle them.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Action Required */}
          {unpaidInvoices.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                Action required
                <span className="numeric text-muted-foreground/60">
                  {unpaidInvoices.length}
                </span>
              </h2>
              <div className="space-y-3">
                {unpaidInvoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} showPayButton />
                ))}
              </div>
            </section>
          )}

          {/* Other Invoices */}
          {otherInvoices.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                {unpaidInvoices.length > 0 ? "Other invoices" : "All invoices"}
                <span className="numeric text-muted-foreground/60">
                  {otherInvoices.length}
                </span>
              </h2>
              <div className="space-y-3">
                {otherInvoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))}
              </div>
            </section>
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
    <Link href={`/portal/invoices/${invoice.id}`} className="block w-full">
      <Card
        className={`group shadow-card hover:shadow-card-hover overflow-hidden rounded-2xl py-0 transition-all duration-200 ${
          isOverdue ? "border-destructive/30" : ""
        }`}
      >
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            {/* Icon + Invoice Info */}
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div
                className={`flex size-10 flex-shrink-0 items-center justify-center rounded-xl ${
                  isOverdue ? "bg-destructive/10" : "bg-primary/10"
                }`}
              >
                <FileText
                  className={`size-5 ${
                    isOverdue
                      ? "text-destructive"
                      : "text-primary"
                  }`}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="numeric text-foreground text-sm font-semibold">
                    {invoice.invoiceNumber}
                  </p>
                  <StatusBadge
                    status={invoice.status}
                    colorMap={INVOICE_STATUS_COLORS}
                    className="text-[10px]"
                  />
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
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
                <p className="text-muted-foreground/70 text-[10px] font-semibold uppercase tracking-[0.1em]">
                  Total
                </p>
                <p className="numeric text-foreground mt-0.5 text-sm font-semibold">
                  {formatINR(invoice.totalAmount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground/70 text-[10px] font-semibold uppercase tracking-[0.1em]">
                  Paid
                </p>
                <p className="numeric mt-0.5 text-sm font-medium text-success">
                  {formatINR(invoice.paidAmount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground/70 text-[10px] font-semibold uppercase tracking-[0.1em]">
                  Balance
                </p>
                <p
                  className={`numeric mt-0.5 text-sm font-semibold ${
                    invoice.balanceDue > 0
                      ? "text-destructive"
                      : "text-success"
                  }`}
                >
                  {formatINR(invoice.balanceDue)}
                </p>
              </div>

              {/* Pay Button or Arrow */}
              {showPayButton && invoice.balanceDue > 0 ? (
                <span className="bg-primary text-primary-foreground hidden items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-opacity group-hover:opacity-90 sm:inline-flex">
                  <CreditCard className="size-3.5" />
                  Pay now
                </span>
              ) : (
                <ArrowUpRight className="text-muted-foreground/40 group-hover:text-primary size-4 flex-shrink-0 transition-colors" />
              )}
            </div>
          </div>

          {/* Due Date Footer */}
          <div
            className={`flex items-center justify-between border-t px-5 py-2.5 text-xs ${
              isOverdue
                ? "border-destructive/20 bg-destructive/[0.06] text-destructive"
                : "text-muted-foreground/70 bg-muted/25"
            }`}
          >
            <span>
              Due{" "}
              <span className="numeric">
                {dueDate.toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </span>
            {isOverdue && <span className="font-semibold">Overdue</span>}
            {/* Mobile Pay Button */}
            {showPayButton && invoice.balanceDue > 0 && (
              <span className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:hidden">
                <CreditCard className="size-3" />
                Pay now
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
