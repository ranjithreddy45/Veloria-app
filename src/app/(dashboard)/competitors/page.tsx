import type { Metadata } from "next";

import { getCompetitors } from "@/actions/competitor.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { CompetitorList } from "./_components/competitor-list";

export const metadata: Metadata = { title: "Competitors" };

// ============================================================
// Competitors Page
// ============================================================

export default async function CompetitorsPage() {
  const result = await getCompetitors();

  const competitors = result.success ? result.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Analytics · Market Intel"
        title="Competitor Analysis"
        help={<PageHelp id="competitors" />}
        description="Track and compare competitors in the event management space."
      />
      <CompetitorList data={competitors} />
    </div>
  );
}
