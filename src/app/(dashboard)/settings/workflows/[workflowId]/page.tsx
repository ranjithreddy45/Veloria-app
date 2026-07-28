import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, PencilIcon, WorkflowIcon } from "lucide-react";

import { getWorkflow } from "@/actions/workflow.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/shared/status-pill";
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
      {/* Back */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 h-8 text-muted-foreground hover:text-foreground"
        >
          <Link href="/settings/workflows">
            <ArrowLeftIcon className="mr-1 size-4" />
            Back to Workflows
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="Settings · Automation"
        icon={WorkflowIcon}
        accent="cyan"
        title={workflow.name}
        description="What fires this workflow, what it does when it fires, and every run it has made so far."
      >
        <StatusPill
          label={workflow.isActive ? "Active" : "Paused"}
          hue={workflow.isActive ? "emerald" : "slate"}
        />
        <Button variant="outline" asChild>
          <Link href={`/settings/workflows/${workflow.id}/edit`}>
            <PencilIcon className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      {/* Detail Content */}
      <WorkflowDetail workflow={workflow} />
    </div>
  );
}
