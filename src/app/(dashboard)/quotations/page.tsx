import type { Metadata } from "next";
import {
  FileTextIcon,
  ClockIcon,
  CheckCircle2Icon,
  IndianRupeeIcon,
} from "lucide-react";
import { auth } from "@/../auth";
import { getSalesQuotations } from "@/actions/sales-quotation.actions";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActions, type QuickActionSpec } from "@/components/ui/quick-actions";
import { StatTile } from "@/components/ui/stat-tile";
import { visibleActions } from "@/lib/permission-claims";
import { hasPermission } from "@/lib/permissions";
import { formatINR } from "@/lib/utils";
import { QuotationsTable, type QuotationListRow } from "./_components/quotations-table";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage() {
  const [res, session] = await Promise.all([getSalesQuotations(), auth()]);
  const rows = (res.success ? (res.data as QuotationListRow[]) : []) ?? [];

  // KPIs derived from the loaded rows (visual-only — no extra fetch).
  const total = rows.length;
  const pending = rows.filter((r) => r.status === "PENDING_APPROVAL").length;
  const accepted = rows.filter(
    (r) => r.status === "APPROVED" || r.status === "SENT"
  ).length;
  const pipelineValue = rows
    .filter((r) => r.status !== "REJECTED")
    .reduce((s, r) => s + Number(r.grandTotal || 0), 0);

  // The page's one action: its create, shown only to someone who can save a
  // quotation (/quotations/new saves through createSalesQuotation, which
  // requires quotes:create). Booking from a quote goes through the quotation's
  // own Block-the-slot card, which applies the advance rule; Leads is a
  // sidebar destination. Neither is repeated here.
  // createSalesQuotation checks quotes:create against the static role matrix,
  // so that check is required too (`when`): a permission granted only through
  // an override would otherwise show a pill whose form fails on save.
  const actions = visibleActions<QuickActionSpec>(session, [
    {
      href: "/quotations/new",
      label: "New quotation",
      hint: "Price an event",
      primary: true,
      permission: "quotes:create",
      when: hasPermission(session?.user?.role ?? "", "quotes:create"),
    },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Sales · Pricing</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold numeric">{total}</span> quotation{total === 1 ? "" : "s"}
            </span>
          </div>
        }
        title="Quotations"
        description="Event quotations built with the calculator — submit for approval, then send to the customer."
        actions={<QuickActions actions={actions} />}
      />

      {total > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-rise-in animate-stagger-1">
          <StatTile
            label="Total quotations"
            value={total}
            accent="gold"
            icon={<FileTextIcon className="size-4" />}
            sub="Built so far"
          />
          <StatTile
            label="Pending approval"
            value={pending}
            accent="amber"
            icon={<ClockIcon className="size-4" />}
            sub="Awaiting sign-off"
          />
          <StatTile
            label="Approved & sent"
            value={accepted}
            accent="emerald"
            icon={<CheckCircle2Icon className="size-4" />}
            sub="Out with customers"
          />
          <StatTile
            label="Quoted value"
            value={formatINR(pipelineValue)}
            accent="indigo"
            icon={<IndianRupeeIcon className="size-4" />}
            sub="Excludes rejected"
          />
        </div>
      )}

      <div className="animate-rise-in animate-stagger-2">
        <QuotationsTable rows={rows} />
      </div>
    </div>
  );
}
