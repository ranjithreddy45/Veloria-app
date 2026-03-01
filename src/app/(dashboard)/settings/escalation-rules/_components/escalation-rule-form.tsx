"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import {
  createEscalationRuleSchema,
  type CreateEscalationRuleInput,
} from "@/schemas/escalation.schema";
import {
  createEscalationRule,
  updateEscalationRule,
} from "@/actions/escalation.actions";
import {
  TASK_CATEGORY_LABELS,
  ESCALATION_LEVEL_LABELS,
} from "@/lib/constants";

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
// Types
// ============================================================

interface EscalationRuleData {
  id: string;
  name: string;
  category: string;
  priority: string;
  delayThresholdMinutes: number;
  level: string;
  notifyUserIds: string[];
  notifyRoles: string[];
  isActive: boolean;
}

interface EscalationRuleFormProps {
  initialData?: EscalationRuleData;
}

// ============================================================
// Options
// ============================================================

const categoryOptions = Object.entries(TASK_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
);

const priorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const levelOptions = Object.entries(ESCALATION_LEVEL_LABELS).map(
  ([value, label]) => ({ value, label })
);

// ============================================================
// EscalationRuleForm Component
// ============================================================

export function EscalationRuleForm({ initialData }: EscalationRuleFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [isActive, setIsActive] = React.useState(initialData?.isActive ?? true);

  const isEditing = !!initialData;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreateEscalationRuleInput>({
    resolver: zodResolver(createEscalationRuleSchema) as any,
    defaultValues: {
      name: initialData?.name ?? "",
      category: (initialData?.category as CreateEscalationRuleInput["category"]) ?? undefined,
      priority: (initialData?.priority as CreateEscalationRuleInput["priority"]) ?? undefined,
      delayThresholdMinutes: initialData?.delayThresholdMinutes ?? 15,
      level: (initialData?.level as CreateEscalationRuleInput["level"]) ?? undefined,
      notifyUserIds: initialData?.notifyUserIds ?? [],
      notifyRoles: initialData?.notifyRoles ?? [],
    },
  });

  async function onSubmit(data: CreateEscalationRuleInput) {
    setIsPending(true);
    try {
      const result = isEditing
        ? await updateEscalationRule(initialData.id, {
            ...data,
            isActive,
          })
        : await createEscalationRule(data);

      if (result.success) {
        toast.success(
          isEditing
            ? "Escalation rule updated successfully"
            : "Escalation rule created successfully"
        );
        router.push("/settings/escalation-rules");
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
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader>
            <CardTitle>Rule Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Rule Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Catering Delay - High Priority"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Category *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoryOptions.map((opt) => (
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
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {priorityOptions.map((opt) => (
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
              name="delayThresholdMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delay Threshold (minutes) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="15"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === "" ? undefined : Number(val));
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Minutes after SLA deadline before escalation triggers
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Escalation Level *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {levelOptions.map((opt) => (
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
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="notifyUserIds"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Notify User IDs</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Comma-separated user IDs (e.g., user1, user2)"
                      value={(field.value ?? []).join(", ")}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(
                          val
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        );
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Specific users to notify when this rule triggers
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notifyRoles"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Notify Roles</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Comma-separated roles (e.g., MANAGER, ADMIN)"
                      value={(field.value ?? []).join(", ")}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(
                          val
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        );
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    All users with these roles will be notified
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Active Toggle (edit only) */}
        {isEditing && (
          <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Rule Active</p>
                  <p className="text-sm text-muted-foreground">
                    Inactive rules will not trigger escalations automatically.
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Update Rule" : "Create Rule"}
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
