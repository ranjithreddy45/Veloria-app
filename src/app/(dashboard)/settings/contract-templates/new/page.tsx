import { PageHeader } from "@/components/layout/page-header";
import { TemplateForm } from "../_components/template-form";

export const metadata = {
  title: "New Contract Template",
};

export default function NewContractTemplatePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Contract Template"
        description="Create a reusable contract template with variable placeholders."
      />
      <TemplateForm />
    </div>
  );
}
