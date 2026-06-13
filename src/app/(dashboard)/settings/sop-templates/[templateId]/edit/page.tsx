import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSOPTemplate } from "@/actions/sop-template.actions";
import { PageHeader } from "@/components/layout/page-header";
import { SOPTemplateForm } from "../../_components/sop-template-form";

export const metadata: Metadata = {
  title: "Edit SOP Template",
};

interface EditSOPTemplatePageProps {
  params: Promise<{ templateId: string }>;
}

export default async function EditSOPTemplatePage({
  params,
}: EditSOPTemplatePageProps) {
  const { templateId } = await params;

  const result = await getSOPTemplate(templateId);

  if (!result.success || !result.data) {
    notFound();
  }

  const template = result.data;

  const initialData = {
    name: template.name,
    description: template.description || "",
    eventType: template.eventType || "",
    isDefault: template.isDefault,
    isActive: template.isActive,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit: ${template.name}`}
        description="Modify this SOP template."
      />
      <div className="mx-auto max-w-3xl">
        <SOPTemplateForm initialData={initialData} templateId={templateId} />
      </div>
    </div>
  );
}
