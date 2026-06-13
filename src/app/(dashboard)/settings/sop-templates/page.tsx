import type { Metadata } from "next";
import Link from "next/link";
import {
  PlusIcon,
  FileCheckIcon,
  ClipboardListIcon,
  StarIcon,
  PencilIcon,
  LayersIcon,
  ListChecksIcon,
} from "lucide-react";

import { getSOPTemplates } from "@/actions/sop-template.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EVENT_PHASE_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "SOP Templates" };

// ============================================================
// SOP Templates List Page
// ============================================================

export default async function SOPTemplatesPage() {
  const result = await getSOPTemplates();
  const templates = result.success ? (result.data ?? []) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="SOP Templates"
        help={<PageHelp id="sop-templates" />}
        description="Standard operating procedures for event execution."
      >
        <Button asChild>
          <Link href="/settings/sop-templates/new">
            <PlusIcon className="mr-2 size-4" />
            New Template
          </Link>
        </Button>
      </PageHeader>

      {templates.length === 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <ClipboardListIcon className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No SOP Templates</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Create your first standard operating procedure template to
              streamline event execution.
            </p>
            <Button asChild className="mt-6">
              <Link href="/settings/sop-templates/new">
                <PlusIcon className="mr-2 size-4" />
                Create Template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const phaseCount = template.phases?.length ?? template._count?.phases ?? 0;
            const taskCount =
              template.phases?.reduce(
                (sum: number, phase: { taskDefinitions?: unknown[] }) =>
                  sum + (phase.taskDefinitions?.length ?? 0),
                0
              ) ?? 0;

            return (
              <Card
                key={template.id}
                className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm flex flex-col"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {template.isDefault && (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40"
                        >
                          <StarIcon className="size-3" />
                          Default
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          template.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40"
                            : "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40"
                        }
                      >
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  {template.description && (
                    <CardDescription className="line-clamp-2">
                      {template.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    {template.eventType && (
                      <Badge variant="secondary">{template.eventType}</Badge>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <LayersIcon className="size-3.5" />
                      {phaseCount} {phaseCount === 1 ? "phase" : "phases"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ListChecksIcon className="size-3.5" />
                      {taskCount} {taskCount === 1 ? "task" : "tasks"}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="border-t pt-4">
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link href={`/settings/sop-templates/${template.id}`}>
                      <FileCheckIcon className="mr-2 size-4" />
                      View Details
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
