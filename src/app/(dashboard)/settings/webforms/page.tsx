import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getWebforms } from "@/actions/webform.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { WebformsTable } from "./_components/webforms-table";

export const metadata: Metadata = { title: "Webforms" };

// ============================================================
// Webforms List Page
// ============================================================

interface WebformListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  fields: unknown[];
  isActive: boolean;
  createdAt: string;
  _count: { submissions: number };
}

export default async function WebformsPage() {
  const result = await getWebforms();

  const webforms = result.success
    ? (result.data.data as WebformListItem[])
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webforms"
        description="Create lead capture forms that can be embedded on your website."
      >
        <Button asChild>
          <Link href="/settings/webforms/new">
            <PlusIcon className="mr-2 size-4" />
            New Webform
          </Link>
        </Button>
      </PageHeader>
      <WebformsTable data={webforms} />
    </div>
  );
}
