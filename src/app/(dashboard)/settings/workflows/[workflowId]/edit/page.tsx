import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkflow } from "@/actions/workflow.actions";
import { PageHeader } from "@/components/layout/page-header";
import { WorkflowForm } from "../../_components/workflow-form";

export const metadata: Metadata = { title: "Edit Workflow" };

// ============================================================
// Edit Workflow Page
// ============================================================

interface EditWorkflowPageProps {
  params: Promise<{ workflowId: string }>;
}

export default async function EditWorkflowPage({
  params,
}: EditWorkflowPageProps) {
  const { workflowId } = await params;
  const result = await getWorkflow(workflowId);

  if (!result.success || !result.data) {
    notFound();
  }

  const workflow = result.data;

  const workflowForForm = {
    id: workflow.id,
    name: workflow.name,
    trigger: workflow.trigger,
    actions: workflow.actions as Array<{ type: string; config: Record<string, unknown> }>,
    isActive: workflow.isActive,
    delayMinutes: workflow.delayMinutes,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Workflow"
        description={`Editing ${workflow.name}`}
      />
      <div className="mx-auto max-w-3xl">
        <WorkflowForm workflow={workflowForForm} />
      </div>
    </div>
  );
}
