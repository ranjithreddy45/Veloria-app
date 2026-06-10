import type { Metadata } from "next";

import { getBlueprints } from "@/actions/blueprint.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { BlueprintsTable } from "./_components/blueprints-table";

export const metadata: Metadata = { title: "Blueprints" };

// ============================================================
// Blueprints List Page
// ============================================================

export default async function BlueprintsPage() {
  const result = await getBlueprints();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blueprints = result.success ? (result.data as any[]) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blueprints"
        help={<PageHelp id="blueprints" />}
        description="Design process flows to enforce status transitions for Leads, Deals, and Bookings."
      />
      <BlueprintsTable data={blueprints} />
    </div>
  );
}
