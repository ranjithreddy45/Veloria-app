import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BoxesIcon, ChevronRightIcon, PencilIcon } from "lucide-react";

import { getResource } from "@/actions/resource.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { RESOURCE_TYPE_LABELS } from "@/lib/constants";
import { ResourceDetail } from "../_components/resource-detail";

export const metadata: Metadata = { title: "Resource Details" };

// ============================================================
// Resource Detail Page
// ============================================================

interface ResourceDetailPageProps {
  params: Promise<{ resourceId: string }>;
}

export default async function ResourceDetailPage({
  params,
}: ResourceDetailPageProps) {
  const { resourceId } = await params;
  const result = await getResource(resourceId);

  if (!result.success || !result.data) {
    notFound();
  }

  const resource = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BoxesIcon}
        accent="teal"
        title={resource.name}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/resources" className="transition-colors hover:text-foreground">
              Resources
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            <span>{RESOURCE_TYPE_LABELS[resource.type] ?? resource.type}</span>
          </span>
        }
        description={resource.description || undefined}
      >
        <Button variant="outline" asChild>
          <Link href={`/resources/${resource.id}/edit`}>
            <PencilIcon className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      {/* Tabs */}
      <ResourceDetail resource={resource} />
    </div>
  );
}
