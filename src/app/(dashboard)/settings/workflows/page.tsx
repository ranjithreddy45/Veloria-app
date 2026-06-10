import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getWorkflows } from "@/actions/workflow.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { WorkflowsTable } from "./_components/workflows-table";

export const metadata: Metadata = { title: "Workflows" };

// ============================================================
// Workflows List Page
// ============================================================

export default async function WorkflowsPage() {
  const result = await getWorkflows();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workflows = result.success ? (result.data as any[]) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        help={<PageHelp id="workflows" />}
        description="Automate tasks with trigger-based workflows and reminders."
      >
        <Button asChild>
          <Link href="/settings/workflows/new">
            <PlusIcon className="mr-2 size-4" />
            New Workflow
          </Link>
        </Button>
      </PageHeader>
      <WorkflowsTable data={workflows} />
    </div>
  );
}
