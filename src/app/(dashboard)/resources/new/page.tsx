import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceForm } from "../_components/resource-form";

export const metadata: Metadata = { title: "New Resource" };

// ============================================================
// Create Resource Page
// ============================================================

export default function NewResourcePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Resource"
        description="Add a new resource to the allocation pool."
      />
      <div className="mx-auto max-w-3xl">
        <ResourceForm />
      </div>
    </div>
  );
}
