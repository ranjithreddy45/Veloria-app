import { notFound } from "next/navigation";
import { getContractTemplate } from "@/actions/contract.actions";
import { PageHeader } from "@/components/layout/page-header";
import { TemplateForm } from "../../_components/template-form";

export const metadata = {
  title: "Edit Contract Template",
};

interface EditContractTemplatePageProps {
  params: Promise<{ templateId: string }>;
}

export default async function EditContractTemplatePage({
  params,
}: EditContractTemplatePageProps) {
  const { templateId } = await params;

  const result = await getContractTemplate(templateId);

  if (!result.success || !result.data) {
    notFound();
  }

  const template = result.data;

  const initialData = {
    id: template.id,
    name: template.name,
    description: template.description || "",
    content: template.content,
    variables: template.variables || [],
    category: template.category || "",
    isActive: template.isActive,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit: ${template.name}`}
        description="Modify this contract template."
      />
      <TemplateForm initialData={initialData} templateId={templateId} />
    </div>
  );
}
