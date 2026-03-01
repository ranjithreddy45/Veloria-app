import type { Metadata } from "next";
import { getTaskTemplates } from "@/actions/task.actions";
import { PageHeader } from "@/components/layout/page-header";
import { TemplateList } from "./_components/template-list";

export const metadata: Metadata = { title: "Task Templates" };

// ============================================================
// Task Templates Page
// ============================================================

export default async function TaskTemplatesPage() {
  const result = await getTaskTemplates();
  const templates = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task Templates"
        description="Reusable task templates for common workflows"
      />

      <TemplateList templates={templates} />
    </div>
  );
}
