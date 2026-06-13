import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmailTemplateForm } from "../_components/template-form";

export const metadata: Metadata = {
  title: "New Email Template",
};

// ============================================================
// Create Email Template Page
// ============================================================

export default function NewEmailTemplatePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Email Template"
        description="Create a reusable email template for campaigns and notifications."
      />
      <div className="mx-auto max-w-3xl">
        <EmailTemplateForm />
      </div>
    </div>
  );
}
