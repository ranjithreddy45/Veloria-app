import Link from "next/link";
import {
  PlusIcon,
  ReceiptIndianRupeeIcon,
  WalletIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
} from "lucide-react";
import { getInvoices } from "@/actions/invoice.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR } from "@/lib/utils";
import { InvoicesView } from "./_components/invoices-view";
import type { InvoiceRow } from "./_components/invoices-table";

export const metadata = {
  title: "Invoices",
};

const num = (v: InvoiceRow["totalAmount"]): number =>
  Number(typeof v === "object" && v !== null ? v.toString() : v) || 0;

export default async function InvoicesPage() {
  const result = await getInvoices();

  const invoices: InvoiceRow[] = result.success ? result.data?.data ?? [] : [];

  const totalInvoiced = invoices.reduce((s, i) => s + num(i.totalAmount), 0);
  const outstanding = invoices.reduce((s, i) => s + num(i.balanceDue), 0);
  const paid = invoices.reduce((s, i) => s + num(i.paidAmount), 0);
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={`FINANCE · ${invoices.length} invoice${
          invoices.length === 1 ? "" : "s"
        } · ${formatINR(outstanding)} outstanding`}
        title="Invoices"
        help={<PageHelp id="invoices" />}
        description="Manage invoices, track payments and generate GST-compliant documents."
      >
        <Button asChild>
          <Link href="/invoices/new">
            <PlusIcon className="mr-2 size-4" />
            New Invoice
          </Link>
        </Button>
      </PageHeader>

      {invoices.length === 0 ? (
        <div className="animate-rise-in animate-stagger-1 rounded-xl border border-dashed bg-card shadow-premium">
          <EmptyState
            icon={<ReceiptIndianRupeeIcon className="size-6" />}
            title="No invoices yet"
            description="Raise your first invoice to bill a client for a booking — or convert an accepted quotation. Payments you collect will be tracked against it here."
            action={
              <Button asChild>
                <Link href="/invoices/new">
                  <PlusIcon className="mr-2 size-4" />
                  New Invoice
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-rise-in animate-stagger-1">
            <StatTile
              label="Total invoiced"
              value={formatINR(totalInvoiced)}
              accent="indigo"
              icon={<ReceiptIndianRupeeIcon className="size-4" />}
              sub={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`}
            />
            <StatTile
              label="Outstanding"
              value={formatINR(outstanding)}
              accent="amber"
              icon={<WalletIcon className="size-4" />}
              sub="Balance due across invoices"
            />
            <StatTile
              label="Paid"
              value={formatINR(paid)}
              accent="emerald"
              icon={<CheckCircle2Icon className="size-4" />}
              sub="Collected to date"
            />
            <StatTile
              label="Overdue"
              value={overdueCount}
              accent="rose"
              icon={<AlertTriangleIcon className="size-4" />}
              sub={overdueCount === 1 ? "invoice past due" : "invoices past due"}
            />
          </div>

          <div className="animate-rise-in animate-stagger-2">
            <InvoicesView data={invoices} />
          </div>
        </>
      )}
    </div>
  );
}
