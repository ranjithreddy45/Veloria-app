import type { Metadata } from "next";
import { getCadences } from "@/actions/cadence.actions";
import { CadencesTable } from "./_components/cadences-table";

export const metadata: Metadata = { title: "Sales Cadences" };

export default async function CadencesPage() {
  const result = await getCadences();
  const cadences = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sales Cadences</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create and manage automated outreach sequences for leads and contacts.
        </p>
      </div>

      {/* Cadences Table */}
      <CadencesTable cadences={cadences} />
    </div>
  );
}
