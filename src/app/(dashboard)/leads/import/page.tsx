import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { LeadImportClient } from "./_components/lead-import-client";

export const metadata: Metadata = { title: "Import Leads" };

export default async function ImportLeadsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!hasPermission((session.user as { role?: string }).role ?? "", "leads:create")) {
    redirect("/not-authorized");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Leads"
        description="Bulk-import leads from your sales spreadsheet. Contacts are de-duplicated by phone number; this is a historical backfill, so no auto-welcome messages are sent."
      />
      <LeadImportClient />
    </div>
  );
}
