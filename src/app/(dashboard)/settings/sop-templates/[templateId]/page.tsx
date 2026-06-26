import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PencilIcon,
  LayersIcon,
  ListChecksIcon,
  CheckCircle2Icon,
  ClockIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  CameraIcon,
} from "lucide-react";

import { getSOPTemplate } from "@/actions/sop-template.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  EVENT_PHASE_LABELS,
  TASK_CATEGORY_LABELS,
} from "@/lib/constants";
import { SeedBuilder } from "../_components/seed-builder";

export const metadata: Metadata = {
  title: "SOP Template",
};

interface SOPTemplateDetailPageProps {
  params: Promise<{ templateId: string }>;
}

export default async function SOPTemplateDetailPage({
  params,
}: SOPTemplateDetailPageProps) {
  const { templateId } = await params;

  const result = await getSOPTemplate(templateId);

  if (!result.success || !result.data) {
    notFound();
  }

  const template = result.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = template as any;
  const phases = t.phases ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        description={template.description || "SOP Template details"}
      >
        <Button asChild variant="outline">
          <Link href={`/settings/sop-templates/${templateId}/edit`}>
            <PencilIcon className="mr-2 size-4" />
            Edit Template
          </Link>
        </Button>
      </PageHeader>

      {/* Template Info Card */}
      <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Template Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {template.eventType && (
              <Badge variant="secondary">{template.eventType}</Badge>
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
            {template.isDefault && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40"
              >
                Default
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <LayersIcon className="size-3.5" />
              {phases.length} {phases.length === 1 ? "phase" : "phases"}
            </span>
            <span className="flex items-center gap-1.5">
              <ListChecksIcon className="size-3.5" />
              {phases.reduce(
                (sum: number, phase: { taskDefinitions?: unknown[] }) =>
                  sum + (phase.taskDefinitions?.length ?? 0),
                0
              )}{" "}
              task definitions
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Provisioning seeds */}
      <SeedBuilder
        templateId={templateId}
        initialKitchenSeed={t.kitchenSeed ?? null}
        initialProcurementSeed={t.procurementSeed ?? null}
        initialDispatchSeed={t.dispatchSeed ?? null}
        initialBeoDefaults={t.beoDefaults ?? null}
      />

      {/* Phases */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Phases & Task Definitions</h2>
        {phases.length === 0 ? (
          <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
            <CardContent className="py-8 text-center text-muted-foreground">
              No phases defined yet. Edit this template to add phases.
            </CardContent>
          </Card>
        ) : (
          phases.map((phase: Record<string, unknown>, index: number) => {
            const taskDefs = (phase.taskDefinitions ?? []) as Record<string, unknown>[];
            return (
              <Card
                key={phase.id as string}
                className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      <span className="text-muted-foreground mr-2">
                        #{index + 1}
                      </span>
                      {phase.name as string}
                    </CardTitle>
                    <Badge variant="secondary">
                      {EVENT_PHASE_LABELS[phase.phase as string] ??
                        (phase.phase as string)}
                    </Badge>
                  </div>
                  {!!phase.description && (
                    <CardDescription>
                      {String(phase.description)}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {taskDefs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No task definitions in this phase.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {taskDefs.map(
                        (task: Record<string, unknown>, taskIdx: number) => (
                          <div
                            key={task.id as string}
                            className="flex items-start gap-3 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 p-3"
                          >
                            <span className="text-xs font-medium text-muted-foreground mt-0.5">
                              {taskIdx + 1}.
                            </span>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">
                                  {String(task.title)}
                                </span>
                                {!!task.isMandatory && (
                                  <AlertTriangleIcon className="size-3.5 text-amber-500" />
                                )}
                                {!!task.requiresApproval && (
                                  <ShieldCheckIcon className="size-3.5 text-violet-500" />
                                )}
                                {!!task.requiresProof && (
                                  <CameraIcon className="size-3.5 text-blue-500" />
                                )}
                              </div>
                              {!!task.description && (
                                <p className="text-xs text-muted-foreground">
                                  {String(task.description)}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {TASK_CATEGORY_LABELS[task.category as string] ??
                                    String(task.category)}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {String(task.priority)}
                                </Badge>
                                {!!task.estimatedMinutes && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <ClockIcon className="size-3" />
                                    {Number(task.estimatedMinutes)}min
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
