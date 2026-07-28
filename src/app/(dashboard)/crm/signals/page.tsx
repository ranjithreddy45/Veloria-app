import type { Metadata } from "next";
import { ActivityIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { SignalsSummaryCards } from "./_components/signals-summary-cards";
import { SalesSignalsFeed } from "./_components/sales-signals-feed";

export const metadata: Metadata = { title: "Sales Signals" };

export default function SalesSignalsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        aura
        icon={ActivityIcon}
        accent="cyan"
        eyebrow="CRM"
        title="Sales Signals"
        description="Real-time CRM activity feed — track every lead, deal, payment, and task as it happens."
        help={<PageHelp id="sales-signals" />}
      />

      {/* Summary KPI Cards */}
      <SignalsSummaryCards />

      {/* Activity Feed */}
      <SalesSignalsFeed />
    </div>
  );
}
