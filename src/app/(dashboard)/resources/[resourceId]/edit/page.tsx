import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResource } from "@/actions/resource.actions";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceForm } from "../../_components/resource-form";

export const metadata: Metadata = { title: "Edit Resource" };

// ============================================================
// Edit Resource Page
// ============================================================

interface EditResourcePageProps {
  params: Promise<{ resourceId: string }>;
}

export default async function EditResourcePage({
  params,
}: EditResourcePageProps) {
  const { resourceId } = await params;
  const result = await getResource(resourceId);

  if (!result.success || !result.data) {
    notFound();
  }

  const resource = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Resource"
        description={`Editing ${resource.name}`}
      />
      <div className="mx-auto max-w-3xl">
        <ResourceForm resource={resource} />
      </div>
    </div>
  );
}
