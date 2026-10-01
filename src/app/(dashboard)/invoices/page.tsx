import Link from "next/link";
import {
  PlusIcon,
  ReceiptIndianRupeeIcon,
  WalletIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
} from "lucide-react";
import { auth } from "@/../auth";
import { getInvoices } from "@/actions/invoice.actions";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActions, type QuickActionSpec } from "@/components/ui/quick-actions";
import { PageHelp } from "@/lib/page-help";
import { visibleActions } from "@/lib/permission-claims";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR } from "@/lib/utils";
import { bookingBalance, isIssuedInvoice } from "@/lib/finance/issued-invoices";
import { InvoicesView } from "./_components/invoices-view";
import type { InvoiceRow } from "./_components/invoices-table";

export const metadata = {
  title: "Invoices",
};

const num = (v: InvoiceRow["totalAmount"]): number =>
  Number(typeof v === "object" && v !== null ? v.toString() : v) || 0;

export default async function InvoicesPage() {
  const [result, session] = await Promise.all([getInvoices(), auth()]);

  const invoices: InvoiceRow[] = result.success ? result.data?.data ?? [] : [];

  // Finance's shared rules (src/lib/finance/issued-invoices.ts), the ones the
  // booking page, the portal and the customer app use: invoiced counts billed
  // invoices (not an unsent draft or a void cancelled one), and outstanding is
  // the balance of invoices still owed, so a fully refunded invoice, whose
  // stored balanceDue is back to its total, is not outstanding.
  const billed = invoices.filter((i) => isIssuedInvoice(i.status));
  const totalInvoiced = billed.reduce((s, i) => s + num(i.totalAmount), 0);
  const outstanding = bookingBalance(
    invoices.map((i) => ({ status: i.status, balanceDue: num(i.balanceDue) }))
  ).balanceDue;
  const paid = invoices.reduce((s, i) => s + num(i.paidAmount), 0);
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  // The page's one action: its create, gated on the permission createInvoice
  // enforces. Payments and bookings are reached from the sidebar.
  // createInvoice checks invoices:create against the static role matrix, so
  // that check is required too (`when`): a permission granted only through an
  // override would otherwise show a pill whose form fails on save.
  const actions = visibleActions<QuickActionSpec>(session, [
    {
      href: "/invoices/new",
      label: "New invoice",
      hint: "Bill a booking",
      permission: "invoices:create",
      when: hasPermission(session?.user?.role ?? "", "invoices:create"),
      primary: true,
    },
  ]);
  // The empty state offers "New invoice" under exactly the same decision as
  // the pill, so a role that cannot create invoices is never shown a create
  // button the pill would hide from it.
  const canCreateInvoices = actions.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span>
            FINANCE ·{" "}
            <span className="numeric">{invoices.length}</span> invoice
            {invoices.length === 1 ? "" : "s"} ·{" "}
            <span className="numeric">{formatINR(outstanding)}</span> outstanding
          </span>
        }
        title="Invoices"
        help={<PageHelp id="invoices" />}
        description="Manage invoices, track payments and generate GST-compliant documents."
        actions={<QuickActions actions={actions} />}
      />

      {invoices.length === 0 ? (
        <div className="animate-rise-in animate-stagger-1 rounded-[22px] border border-dashed bg-card/40">
          <EmptyState
            icon={<ReceiptIndianRupeeIcon className="size-6" />}
            title="No invoices yet"
            description={
              canCreateInvoices
                ? "Raise your first invoice to bill a client for a booking — or convert an accepted quotation. Payments you collect will be tracked against it here."
                : "An invoice bills a client for a booking. Invoices appear here once they are raised, with the payments collected against each one."
            }
            action={
              canCreateInvoices ? (
                <Button asChild>
                  <Link href="/invoices/new">
                    <PlusIcon className="mr-2 size-4" />
                    New invoice
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-rise-in animate-stagger-1">
            <StatTile
              label="Total invoiced"
              value={<span className="numeric">{formatINR(totalInvoiced)}</span>}
              accent="indigo"
              icon={<ReceiptIndianRupeeIcon className="size-4" />}
              sub={`${billed.length} billed invoice${billed.length === 1 ? "" : "s"}`}
            />
            <StatTile
              label="Outstanding"
              value={<span className="numeric">{formatINR(outstanding)}</span>}
              accent="amber"
              icon={<WalletIcon className="size-4" />}
              sub="Balance due across invoices"
            />
            <StatTile
              label="Paid"
              value={<span className="numeric">{formatINR(paid)}</span>}
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
