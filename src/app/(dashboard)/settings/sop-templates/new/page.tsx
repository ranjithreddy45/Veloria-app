import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SOPTemplateForm } from "../_components/sop-template-form";

export const metadata: Metadata = { title: "New SOP Template | Veloria Grand" };

// ============================================================
// Create SOP Template Page
// ============================================================

export default function NewSOPTemplatePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New SOP Template"
        description="Create a standard operating procedure template."
      />
      <div className="mx-auto max-w-3xl">
        <SOPTemplateForm />
      </div>
    </div>
  );
}
