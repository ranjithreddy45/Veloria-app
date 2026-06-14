"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  TrashIcon,
  GripVerticalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Loader2Icon,
  LinkIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  updateApprovalRule,
  getApprovalRule,
  type ApprovalChainStepData,
} from "@/actions/approval.actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ============================================================
// Local Step Type
// ============================================================

interface LocalStep {
  tempId: string;
  order: number;
  approverType: "USER" | "ROLE";
  approverId: string;
  isOptional: boolean;
}

// ============================================================
// Available Roles
// ============================================================

const AVAILABLE_ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "SALES_EXEC", label: "Sales Executive" },
  { value: "SALES_HEAD", label: "Sales Head" },
  { value: "EVENT_COORDINATOR", label: "Event Coordinator" },
  { value: "FINANCE", label: "Finance" },
  { value: "STAFF", label: "Staff" },
];

// ============================================================
// Props
// ============================================================

interface ChainBuilderProps {
  ruleId: string | null;
  initialSteps: ApprovalChainStepData[];
  users: { id: string; name: string | null; email: string; role: string }[];
}

// ============================================================
// Component
// ============================================================

export function ChainBuilder({
  ruleId,
  initialSteps,
  users,
}: ChainBuilderProps) {
  const router = useRouter();

  const [steps, setSteps] = React.useState<LocalStep[]>(() =>
    initialSteps.map((s, i) => ({
      tempId: `step-${i}-${Date.now()}`,
      order: s.order,
      approverType: s.approverType as "USER" | "ROLE",
      approverId: s.approverId,
      isOptional: s.isOptional,
    }))
  );
  const [saving, setSaving] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  function addStep() {
    const nextOrder = steps.length;
    setSteps((prev) => [
      ...prev,
      {
        tempId: `step-${nextOrder}-${Date.now()}`,
        order: nextOrder,
        approverType: "USER",
        approverId: "",
        isOptional: false,
      },
    ]);
  }

  function removeStep(index: number) {
    setSteps((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Re-number orders
      return updated.map((s, i) => ({ ...s, order: i }));
    });
  }

  function updateStep(index: number, updates: Partial<LocalStep>) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  }

  function moveStep(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= steps.length) return;
    setSteps((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return arr.map((s, i) => ({ ...s, order: i }));
    });
  }

  // Drag handlers
  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      moveStep(dragIndex, index);
      setDragIndex(index);
    }
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  async function handleSave() {
    if (!ruleId) {
      toast.error("Save the rule first before configuring the chain");
      return;
    }

    // Validate all steps have an approverId
    const invalid = steps.find((s) => !s.approverId);
    if (invalid) {
      toast.error("All steps must have an approver selected");
      return;
    }

    setSaving(true);

    // Fetch current rule data to preserve rule fields
    const ruleResult = await getApprovalRule(ruleId);
    if (!ruleResult.success) {
      toast.error("Failed to fetch rule data");
      setSaving(false);
      return;
    }

    const rule = ruleResult.data;

    const result = await updateApprovalRule(
      ruleId,
      {
        name: rule.name,
        entityType: rule.entityType as "QUOTE" | "DEAL" | "BOOKING",
        description: rule.description,
        isActive: rule.isActive,
        priority: rule.priority,
        conditions: (rule.conditions ?? []).map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value,
        })),
      },
      steps.map((s) => ({
        order: s.order,
        approverType: s.approverType,
        approverId: s.approverId,
        isOptional: s.isOptional,
      }))
    );

    if (result.success) {
      toast.success("Approval chain updated");
      router.refresh();
    } else {
      toast.error(result.error);
    }

    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="size-4 text-zinc-500" />
            Approval Chain
          </CardTitle>
          <Button variant="outline" size="sm" onClick={addStep} type="button">
            <PlusIcon className="mr-1 size-3" />
            Add Step
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-400">
              No approval steps defined. Add steps to create an approval chain.
            </p>
          </div>
        )}

        {steps.map((step, index) => (
          <div
            key={step.tempId}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "rounded-lg border bg-card p-3 transition-all",
              dragIndex === index && "opacity-50 border-dashed",
              "hover:shadow-sm"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Drag handle + order number */}
              <div className="flex flex-col items-center gap-1 pt-1">
                <GripVerticalIcon className="size-4 text-zinc-300 cursor-grab active:cursor-grabbing" />
                <div className="flex size-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
                  {index + 1}
                </div>
              </div>

              {/* Step config */}
              <div className="flex-1 space-y-3">
                {/* Approver Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={step.approverType}
                      onValueChange={(v) =>
                        updateStep(index, {
                          approverType: v as "USER" | "ROLE",
                          approverId: "",
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="ROLE">Role</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Approver ID */}
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {step.approverType === "USER" ? "User" : "Role"}
                    </Label>
                    <Select
                      value={step.approverId}
                      onValueChange={(v) =>
                        updateStep(index, { approverId: v })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue
                          placeholder={
                            step.approverType === "USER"
                              ? "Select user..."
                              : "Select role..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {step.approverType === "USER"
                          ? users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name ?? user.email}
                              </SelectItem>
                            ))
                          : AVAILABLE_ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Optional toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={step.isOptional}
                    onCheckedChange={(v) =>
                      updateStep(index, { isOptional: v })
                    }
                    className="scale-75"
                  />
                  <span className="text-xs text-zinc-500">Optional step</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveStep(index, index - 1)}
                  disabled={index === 0}
                  className="h-6 w-6 p-0"
                >
                  <ArrowUpIcon className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveStep(index, index + 1)}
                  disabled={index === steps.length - 1}
                  className="h-6 w-6 p-0"
                >
                  <ArrowDownIcon className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStep(index)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                >
                  <TrashIcon className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {/* Save button */}
        {ruleId && steps.length > 0 && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-4"
            variant="outline"
          >
            {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Save Chain ({steps.length} step{steps.length !== 1 ? "s" : ""})
          </Button>
        )}

        {!ruleId && steps.length > 0 && (
          <p className="text-xs text-amber-600 text-center mt-2">
            Save the rule first, then configure the approval chain.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
