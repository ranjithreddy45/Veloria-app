import type { Metadata } from "next";

import { getDocuments } from "@/actions/document.actions";
import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { DocumentList } from "./_components/document-list";

export const metadata: Metadata = { title: "Documents | Veloria Grand" };

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
        title="Documents"
        help={<PageHelp id="documents" />}
        description="Manage contracts, invoices, photos, and other files."
      />
      <DocumentList data={documents} venues={venues} />
    </div>
  );
}
