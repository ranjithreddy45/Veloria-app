import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEmailTemplateById } from "@/actions/email-template.actions";
import { PageHeader } from "@/components/layout/page-header";
import { EmailTemplateForm } from "../../_components/template-form";

export const metadata: Metadata = {
  title: "Edit Email Template | Veloria Grand",
};

// ============================================================
// Edit Email Template Page
// ============================================================

interface EditEmailTemplatePageProps {
  params: Promise<{ templateId: string }>;
}

export default async function EditEmailTemplatePage({
  params,
}: EditEmailTemplatePageProps) {
  const { templateId } = await params;

  const result = await getEmailTemplateById(templateId);

  if (!result.success || !result.data) {
    notFound();
  }

  const template = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit: ${template.name}`}
        description="Modify this email template."
      />
      <div className="mx-auto max-w-3xl">
        <EmailTemplateForm
          template={{
            id: template.id,
            name: template.name,
            subject: template.subject,
            htmlContent: template.htmlContent,
            category: template.category,
            isActive: template.isActive,
          }}
        />
      </div>
    </div>
  );
}
