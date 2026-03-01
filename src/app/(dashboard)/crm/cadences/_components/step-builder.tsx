"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MailIcon,
  CheckSquareIcon,
  MessageCircleIcon,
  ClockIcon,
  StickyNoteIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  GripVerticalIcon,
} from "lucide-react";

import type { CadenceStepData } from "@/actions/cadence.actions";
import { createStep, updateStep, deleteStep } from "@/actions/cadence.actions";
import type { CadenceStepInput } from "@/schemas/cadence.schema";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { StepFormDialog } from "./step-form-dialog";

// ============================================================
// Step Type Config
// ============================================================

const STEP_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  SEND_EMAIL: {
    label: "Send Email",
    icon: MailIcon,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  CREATE_TASK: {
    label: "Create Task",
    icon: CheckSquareIcon,
    color: "text-orange-600 bg-orange-50 border-orange-200",
  },
  SEND_WHATSAPP: {
    label: "Send WhatsApp",
    icon: MessageCircleIcon,
    color: "text-green-600 bg-green-50 border-green-200",
  },
  WAIT: {
    label: "Wait",
    icon: ClockIcon,
    color: "text-muted-foreground bg-muted/50 border-border",
  },
  LOG_NOTE: {
    label: "Log Note",
    icon: StickyNoteIcon,
    color: "text-yellow-600 bg-yellow-50 border-yellow-200",
  },
};

function getStepDescription(step: CadenceStepData): string {
  const config = step.config as Record<string, unknown>;
  switch (step.stepType) {
    case "SEND_EMAIL":
      return (config.subject as string) ?? "Email step";
    case "CREATE_TASK":
      return (config.title as string) ?? "Task step";
    case "SEND_WHATSAPP":
      return (config.message as string)?.slice(0, 60) ?? "WhatsApp step";
    case "WAIT":
      return "Wait for delay period";
    case "LOG_NOTE":
      return (config.content as string)?.slice(0, 60) ?? "Note step";
    default:
      return "Step";
  }
}

function formatDelay(days: number, hours: number): string {
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  return parts.length > 0 ? parts.join(" ") : "Immediate";
}

// ============================================================
// Props
// ============================================================

interface StepBuilderProps {
  cadenceId: string;
  cadenceStatus: string;
  steps: CadenceStepData[];
}

// ============================================================
// Component
// ============================================================

export function StepBuilder({ cadenceId, cadenceStatus, steps }: StepBuilderProps) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<CadenceStepData | null>(null);
  const [deleting, setDeleting] = React.useState<CadenceStepData | null>(null);
  const [loading, setLoading] = React.useState(false);

  const editable = ["DRAFT", "PAUSED"].includes(cadenceStatus);

  // ---- Create ----
  async function handleCreate(input: CadenceStepInput) {
    setLoading(true);
    const result = await createStep(cadenceId, input);
    setLoading(false);

    if (result.success) {
      toast.success("Step added");
      setCreating(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // ---- Update ----
  async function handleUpdate(input: CadenceStepInput) {
    if (!editing) return;
    setLoading(true);
    const result = await updateStep(editing.id, input);
    setLoading(false);

    if (result.success) {
      toast.success("Step updated");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // ---- Delete ----
  async function handleDelete() {
    if (!deleting) return;
    setLoading(true);
    const result = await deleteStep(deleting.id);
    setLoading(false);

    if (result.success) {
      toast.success("Step deleted");
      setDeleting(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <div className="space-y-0">
        {steps.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm">
                No steps yet. Add your first step to build the cadence.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            {steps.map((step, index) => {
              const typeConfig = STEP_TYPE_CONFIG[step.stepType];
              const Icon = typeConfig?.icon ?? ClockIcon;
              const isLast = index === steps.length - 1;

              return (
                <div key={step.id} className="relative flex gap-4">
                  {/* Timeline Line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${typeConfig?.color ?? "bg-muted/50 text-muted-foreground border-border"}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {!isLast && (
                      <div className="bg-border w-0.5 flex-1 min-h-[24px]" />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className={`flex-1 pb-6 ${isLast ? "pb-0" : ""}`}>
                    <Card>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {editable && (
                              <GripVerticalIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                            )}
                            <span className="text-muted-foreground text-xs font-medium">
                              Step {step.order + 1}
                            </span>
                            <span className="font-medium text-sm">
                              {typeConfig?.label ?? step.stepType}
                            </span>
                            <span className="text-muted-foreground rounded bg-muted px-1.5 py-0.5 text-xs">
                              {formatDelay(step.delayDays, step.delayHours)}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1 text-sm truncate">
                            {getStepDescription(step)}
                          </p>
                        </div>

                        {editable && (
                          <div className="flex items-center gap-1 shrink-0 ml-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditing(step)}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleting(step)}
                            >
                              <Trash2Icon className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Step Button */}
        {editable && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => setCreating(true)}
              className="w-full max-w-xs"
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Step
            </Button>
          </div>
        )}
      </div>

      {/* Create Step Dialog */}
      <StepFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Add Step"
        defaultOrder={steps.length}
        onSubmit={handleCreate}
        loading={loading}
      />

      {/* Edit Step Dialog */}
      <StepFormDialog
        open={!!editing}
        onOpenChange={() => setEditing(null)}
        title="Edit Step"
        defaultValues={
          editing
            ? {
                stepType: editing.stepType as CadenceStepInput["stepType"],
                config: editing.config as Record<string, unknown>,
                delayDays: editing.delayDays,
                delayHours: editing.delayHours,
                order: editing.order,
              }
            : undefined
        }
        defaultOrder={editing?.order ?? steps.length}
        onSubmit={handleUpdate}
        loading={loading}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Step</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this step? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
