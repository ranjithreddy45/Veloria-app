"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  GripVerticalIcon,
} from "lucide-react";
import {
  workflowSchema,
  type WorkflowInput,
} from "@/schemas/workflow.schema";
import { createWorkflow, updateWorkflow } from "@/actions/workflow.actions";
import { WORKFLOW_TRIGGER_LABELS } from "@/lib/constants";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// WorkflowForm Props
// ============================================================

interface WorkflowData {
  id: string;
  name: string;
  trigger: string;
  actions: Array<{ type: string; config: Record<string, unknown> }>;
  isActive: boolean;
  delayMinutes: number | null;
}

interface WorkflowFormProps {
  workflow?: WorkflowData;
}

// ============================================================
// Trigger & Action Type Options
// ============================================================

const triggerOptions = Object.entries(WORKFLOW_TRIGGER_LABELS).map(
  ([value, label]) => ({ value, label })
);

const actionTypeOptions = [
  { value: "SEND_EMAIL", label: "Send Email" },
  { value: "CREATE_TASK", label: "Create Task" },
  { value: "SEND_NOTIFICATION", label: "Send Notification" },
  { value: "UPDATE_STATUS", label: "Update Status" },
];

// ============================================================
// Action Config Fields Component
// ============================================================

function ActionConfigFields({
  type,
  index,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form,
}: {
  type: string;
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
}) {
  switch (type) {
    case "SEND_EMAIL":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name={`actions.${index}.config.template`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Template</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., booking_confirmation" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`actions.${index}.config.to`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recipient</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., {{contact.email}}" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      );

    case "CREATE_TASK":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name={`actions.${index}.config.title`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Task Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Follow up with client" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`actions.${index}.config.assigneeId`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assignee ID (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="User ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      );

    case "SEND_NOTIFICATION":
      return (
        <FormField
          control={form.control}
          name={`actions.${index}.config.message`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notification Message</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., New booking confirmed for {{event.name}}"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "UPDATE_STATUS":
      return (
        <FormField
          control={form.control}
          name={`actions.${index}.config.status`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Status</FormLabel>
              <FormControl>
                <Input placeholder="e.g., CONFIRMED" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    default:
      return null;
  }
}

// ============================================================
// Default config for each action type
// ============================================================

function getDefaultConfig(type: string): Record<string, string> {
  switch (type) {
    case "SEND_EMAIL":
      return { template: "", to: "" };
    case "CREATE_TASK":
      return { title: "", assigneeId: "" };
    case "SEND_NOTIFICATION":
      return { message: "" };
    case "UPDATE_STATUS":
      return { status: "" };
    default:
      return {};
  }
}

// ============================================================
// WorkflowForm Component
// ============================================================

export function WorkflowForm({ workflow }: WorkflowFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const isEditing = !!workflow;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<WorkflowInput>({
    resolver: zodResolver(workflowSchema) as any,
    defaultValues: {
      name: workflow?.name ?? "",
      trigger: (workflow?.trigger as WorkflowInput["trigger"]) ?? undefined,
      actions: (workflow?.actions as WorkflowInput["actions"]) ?? [
        { type: "SEND_EMAIL", config: { template: "", to: "" } },
      ],
      isActive: workflow?.isActive ?? true,
      delayMinutes: workflow?.delayMinutes ?? undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "actions",
  });

  async function onSubmit(data: WorkflowInput) {
    setIsPending(true);
    try {
      const result = isEditing
        ? await updateWorkflow(workflow.id, data)
        : await createWorkflow(data);

      if (result.success) {
        toast.success(
          isEditing
            ? "Workflow updated successfully"
            : "Workflow created successfully"
        );
        router.push(
          isEditing
            ? `/settings/workflows/${workflow.id}`
            : "/settings/workflows"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workflow Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Booking Confirmation Flow" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="trigger"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trigger *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select trigger" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {triggerOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="delayMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delay (minutes)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === "" ? undefined : Number(val));
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional delay before executing actions
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-end">
                  <FormLabel>Active</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <span className="text-muted-foreground text-sm">
                      {field.value ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Actions Builder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Actions</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  type: "SEND_EMAIL",
                  config: { template: "", to: "" },
                })
              }
            >
              <PlusIcon className="mr-2 size-4" />
              Add Action
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 && (
              <p className="text-muted-foreground text-center text-sm py-8">
                No actions added yet. Click &quot;Add Action&quot; to get started.
              </p>
            )}

            {fields.map((field, index) => {
              const actionType = form.watch(`actions.${index}.type`);

              return (
                <Card key={field.id} className="border-dashed">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <GripVerticalIcon className="size-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Action {index + 1}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => remove(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="size-4" />
                        <span className="sr-only">Remove action</span>
                      </Button>
                    </div>

                    <FormField
                      control={form.control}
                      name={`actions.${index}.type`}
                      render={({ field: typeField }) => (
                        <FormItem>
                          <FormLabel>Action Type</FormLabel>
                          <Select
                            value={typeField.value}
                            onValueChange={(val) => {
                              typeField.onChange(val);
                              // Reset config when type changes
                              form.setValue(
                                `actions.${index}.config`,
                                getDefaultConfig(val) as never
                              );
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select action type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {actionTypeOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <ActionConfigFields
                      type={actionType}
                      index={index}
                      form={form}
                    />
                  </CardContent>
                </Card>
              );
            })}

            {form.formState.errors.actions?.message && (
              <p className="text-sm text-destructive">
                {form.formState.errors.actions.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Update Workflow" : "Create Workflow"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
