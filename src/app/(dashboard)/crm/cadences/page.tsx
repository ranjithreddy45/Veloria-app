import type { Metadata } from "next";
import { RepeatIcon } from "lucide-react";
import { getCadences } from "@/actions/cadence.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { CadencesTable } from "./_components/cadences-table";

export const metadata: Metadata = { title: "Sales Cadences" };

export default async function CadencesPage() {
  const result = await getCadences();
  const cadences = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        icon={RepeatIcon}
        accent="gold"
        eyebrow="CRM"
        title="Sales Cadences"
        description="Create and manage automated outreach sequences for leads and contacts."
        help={<PageHelp id="cadences" />}
      />

      {/* Cadences Table */}
      <CadencesTable cadences={cadences} />
    </div>
  );
}
