import type { Metadata } from "next";
import { getTaskTemplates } from "@/actions/task.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
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
        help={<PageHelp id="task-templates" />}
        description="Reusable task templates for common workflows"
      />

      <TemplateList templates={templates} />
    </div>
  );
}
