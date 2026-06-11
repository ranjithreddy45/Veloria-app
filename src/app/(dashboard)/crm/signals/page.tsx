import type { Metadata } from "next";
import { PageHelp } from "@/lib/page-help";
import { SignalsSummaryCards } from "./_components/signals-summary-cards";
import { SalesSignalsFeed } from "./_components/sales-signals-feed";

export const metadata: Metadata = { title: "SalesSignals" };

export default function SalesSignalsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Sales Signals</h1>
          <PageHelp id="sales-signals" />
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Real-time CRM activity feed — track every lead, deal, payment, and
          task as it happens.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <SignalsSummaryCards />

      {/* Activity Feed */}
      <SalesSignalsFeed />
    </div>
  );
}
