import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { getResource } from "@/actions/resource.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {resource.name}
            </h1>
            <Badge variant="secondary">
              {RESOURCE_TYPE_LABELS[resource.type] ?? resource.type}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {resource.description || "Resource Details"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/resources/${resource.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <ResourceDetail resource={resource} />
    </div>
  );
}
