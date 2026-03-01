import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { getWorkflow } from "@/actions/workflow.actions";
import { Button } from "@/components/ui/button";
import { WorkflowDetail } from "./_components/workflow-detail";

export const metadata: Metadata = { title: "Workflow Details" };

// ============================================================
// Workflow Detail Page
// ============================================================

interface WorkflowDetailPageProps {
  params: Promise<{ workflowId: string }>;
}

export default async function WorkflowDetailPage({
  params,
}: WorkflowDetailPageProps) {
  const { workflowId } = await params;
  const result = await getWorkflow(workflowId);

  if (!result.success || !result.data) {
    notFound();
  }

  const workflow = {
    ...result.data,
    actions: result.data.actions as Array<{ type: string; config: Record<string, unknown> }>,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {workflow.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Workflow Details and Execution Logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/settings/workflows/${workflow.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Detail Content */}
      <WorkflowDetail workflow={workflow} />
    </div>
  );
}
