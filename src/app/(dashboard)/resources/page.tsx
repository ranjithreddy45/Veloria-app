import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getResources } from "@/actions/resource.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ResourcesTable } from "./_components/resources-table";

export const metadata: Metadata = { title: "Resources" };

// ============================================================
// Resources List Page
// ============================================================

export default async function ResourcesPage() {
  const result = await getResources();

  const resources = result.success ? result.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resources"
        description="Manage staff, equipment, vehicles, and venue add-ons."
      >
        <Button asChild>
          <Link href="/resources/new">
            <PlusIcon className="mr-2 size-4" />
            New Resource
          </Link>
        </Button>
      </PageHeader>
      <ResourcesTable data={resources} />
    </div>
  );
}
