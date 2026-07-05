import type { Metadata } from "next";

import { getDocuments } from "@/actions/document.actions";
import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { DocumentList } from "./_components/document-list";

export const metadata: Metadata = { title: "Documents" };

// ============================================================
// Documents Page
// ============================================================

export default async function DocumentsPage() {
  const [docsResult, venuesResult] = await Promise.all([
    getDocuments(),
    getVenues(),
  ]);

  const documents = docsResult.success ? docsResult.data.data : [];
  const venues = venuesResult.success ? venuesResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Workspace · Files</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{documents.length}</span> document{documents.length === 1 ? "" : "s"}
            </span>
          </div>
        }
        title="Documents"
        help={<PageHelp id="documents" />}
        description="Manage contracts, invoices, photos, and other files."
      />
      <DocumentList data={documents} venues={venues} />
    </div>
  );
}
