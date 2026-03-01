import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getSyncLogs, getSyncStats } from "@/actions/accounting.actions";
import { TallyConfigForm } from "./_components/tally-config-form";
import { TallySyncDashboard } from "./_components/tally-sync-dashboard";

export const metadata: Metadata = { title: "Tally Integration" };

// ============================================================
// Tally Integration Settings Page
// ============================================================

export default async function TallyIntegrationPage() {
  const [statsResult, logsResult] = await Promise.all([
    getSyncStats(),
    getSyncLogs({ limit: 20 }),
  ]);

  const stats = statsResult.success
    ? statsResult.data
    : { pending: 0, synced: 0, failed: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = logsResult.success ? (logsResult.data as any).data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tally Integration"
        description="Configure and monitor Tally accounting sync."
      />

      <TallyConfigForm />

      <TallySyncDashboard initialStats={stats} initialLogs={logs} />
    </div>
  );
}
