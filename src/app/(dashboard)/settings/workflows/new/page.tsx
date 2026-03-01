import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { WorkflowForm } from "../_components/workflow-form";

export const metadata: Metadata = { title: "New Workflow" };

// ============================================================
// Create Workflow Page
// ============================================================

export default function NewWorkflowPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Workflow"
        description="Create an automated workflow with trigger-based actions."
      />
      <div className="mx-auto max-w-3xl">
        <WorkflowForm />
      </div>
    </div>
  );
}
