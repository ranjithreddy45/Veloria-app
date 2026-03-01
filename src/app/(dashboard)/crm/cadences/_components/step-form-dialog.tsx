"use client";

import * as React from "react";

import type { CadenceStepInput } from "@/schemas/cadence.schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// ============================================================
// Step Type Options
// ============================================================

const STEP_TYPES = [
  { value: "SEND_EMAIL", label: "Send Email" },
  { value: "CREATE_TASK", label: "Create Task" },
  { value: "SEND_WHATSAPP", label: "Send WhatsApp" },
  { value: "WAIT", label: "Wait" },
  { value: "LOG_NOTE", label: "Log Note" },
] as const;

const TASK_PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
] as const;

// ============================================================
// Props
// ============================================================

interface StepFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  defaultValues?: CadenceStepInput;
  defaultOrder: number;
  onSubmit: (data: CadenceStepInput) => void;
  loading?: boolean;
}

// ============================================================
// Component
// ============================================================

export function StepFormDialog({
  open,
  onOpenChange,
  title,
  defaultValues,
  defaultOrder,
  onSubmit,
  loading,
}: StepFormDialogProps) {
  const [stepType, setStepType] = React.useState<CadenceStepInput["stepType"]>(
    defaultValues?.stepType ?? "SEND_EMAIL"
  );
  const [delayDays, setDelayDays] = React.useState(
    defaultValues?.delayDays ?? 0
  );
  const [delayHours, setDelayHours] = React.useState(
    defaultValues?.delayHours ?? 0
  );

  // Email config
  const [emailSubject, setEmailSubject] = React.useState(
    (defaultValues?.config?.subject as string) ?? ""
  );
  const [emailBody, setEmailBody] = React.useState(
    (defaultValues?.config?.body as string) ?? ""
  );

  // Task config
  const [taskTitle, setTaskTitle] = React.useState(
    (defaultValues?.config?.title as string) ?? ""
  );
  const [taskDescription, setTaskDescription] = React.useState(
    (defaultValues?.config?.description as string) ?? ""
  );
  const [taskPriority, setTaskPriority] = React.useState(
    (defaultValues?.config?.priority as string) ?? "MEDIUM"
  );
  const [taskDueDays, setTaskDueDays] = React.useState(
    (defaultValues?.config?.dueDays as number) ?? 1
  );

  // WhatsApp config
  const [whatsappMessage, setWhatsappMessage] = React.useState(
    (defaultValues?.config?.message as string) ?? ""
  );

  // Note config
  const [noteContent, setNoteContent] = React.useState(
    (defaultValues?.config?.content as string) ?? ""
  );

  // Reset form when dialog opens with new defaults
  React.useEffect(() => {
    if (open) {
      setStepType(defaultValues?.stepType ?? "SEND_EMAIL");
      setDelayDays(defaultValues?.delayDays ?? 0);
      setDelayHours(defaultValues?.delayHours ?? 0);
      setEmailSubject((defaultValues?.config?.subject as string) ?? "");
      setEmailBody((defaultValues?.config?.body as string) ?? "");
      setTaskTitle((defaultValues?.config?.title as string) ?? "");
      setTaskDescription((defaultValues?.config?.description as string) ?? "");
      setTaskPriority((defaultValues?.config?.priority as string) ?? "MEDIUM");
      setTaskDueDays((defaultValues?.config?.dueDays as number) ?? 1);
      setWhatsappMessage((defaultValues?.config?.message as string) ?? "");
      setNoteContent((defaultValues?.config?.content as string) ?? "");
    }
  }, [open, defaultValues]);

  function buildConfig(): Record<string, unknown> {
    switch (stepType) {
      case "SEND_EMAIL":
        return { subject: emailSubject, body: emailBody };
      case "CREATE_TASK":
        return {
          title: taskTitle,
          description: taskDescription,
          priority: taskPriority,
          dueDays: taskDueDays,
        };
      case "SEND_WHATSAPP":
        return { message: whatsappMessage };
      case "WAIT":
        return {};
      case "LOG_NOTE":
        return { content: noteContent };
      default:
        return {};
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      stepType,
      config: buildConfig(),
      delayDays,
      delayHours,
      order: defaultValues?.order ?? defaultOrder,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step Type */}
          <div className="space-y-1.5">
            <Label>Step Type</Label>
            <Select
              value={stepType}
              onValueChange={(v) =>
                setStepType(v as CadenceStepInput["stepType"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Delay Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Delay (Days)</Label>
              <Input
                type="number"
                min={0}
                value={delayDays}
                onChange={(e) => setDelayDays(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Delay (Hours)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={delayHours}
                onChange={(e) => setDelayHours(Number(e.target.value))}
              />
            </div>
          </div>

          <Separator />

          {/* Dynamic Config */}
          {stepType === "SEND_EMAIL" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Email subject line"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Email body content..."
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  rows={4}
                />
              </div>
            </div>
          )}

          {stepType === "CREATE_TASK" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Task description..."
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={taskPriority}
                    onValueChange={setTaskPriority}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Due In (Days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={taskDueDays}
                    onChange={(e) => setTaskDueDays(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          {stepType === "SEND_WHATSAPP" && (
            <div className="space-y-1.5">
              <Label>Message</Label>
              <textarea
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                placeholder="WhatsApp message..."
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                rows={4}
              />
            </div>
          )}

          {stepType === "WAIT" && (
            <div className="rounded-md border border-dashed p-4">
              <p className="text-muted-foreground text-sm text-center">
                Wait step -- the delay is configured above. No additional
                configuration needed.
              </p>
            </div>
          )}

          {stepType === "LOG_NOTE" && (
            <div className="space-y-1.5">
              <Label>Note Content</Label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Note content..."
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                rows={4}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : defaultValues ? "Update Step" : "Add Step"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
