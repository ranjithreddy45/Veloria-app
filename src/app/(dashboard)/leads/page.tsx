import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getLeads } from "@/actions/lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "./_components/leads-table";

export const metadata: Metadata = { title: "Leads" };

// ============================================================
// Leads List Page
// ============================================================

export default async function LeadsPage() {
  const result = await getLeads();

  const leads = result.success ? result.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Track and manage your sales leads."
      >
        <Button asChild>
          <Link href="/leads/new">
            <PlusIcon className="mr-2 size-4" />
            New Lead
          </Link>
        </Button>
      </PageHeader>
      <LeadsTable data={leads} />
    </div>
  );
}
