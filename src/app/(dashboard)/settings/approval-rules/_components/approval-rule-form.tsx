"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  TrashIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  createApprovalRule,
  updateApprovalRule,
  type ApprovalRuleData,
} from "@/actions/approval.actions";
import type { ApprovalChainStepInput } from "@/schemas/approval.schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Condition Type
// ============================================================

interface Condition {
  field: string;
  operator: string;
  value: string;
}

// ============================================================
// Props
// ============================================================

interface ApprovalRuleFormProps {
  rule: ApprovalRuleData | null;
  users: { id: string; name: string | null; email: string; role: string }[];
}

// ============================================================
// Component
// ============================================================

export function ApprovalRuleForm({ rule, users }: ApprovalRuleFormProps) {
  const router = useRouter();
  const isNew = !rule;

  // Form state
  const [name, setName] = React.useState(rule?.name ?? "");
  const [entityType, setEntityType] = React.useState(
    rule?.entityType ?? "DEAL"
  );
  const [description, setDescription] = React.useState(
    rule?.description ?? ""
  );
  const [priority, setPriority] = React.useState(rule?.priority ?? 0);
  const [isActive, setIsActive] = React.useState(rule?.isActive ?? true);
  const [conditions, setConditions] = React.useState<Condition[]>(() => {
    if (rule?.conditions && Array.isArray(rule.conditions)) {
      return rule.conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: Array.isArray(c.value)
          ? c.value.join(", ")
          : String(c.value),
      }));
    }
    return [];
  });

  const [saving, setSaving] = React.useState(false);

  function addCondition() {
    setConditions((prev) => [
      ...prev,
      { field: "totalAmount", operator: "gt", value: "" },
    ]);
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCondition(
    index: number,
    key: keyof Condition,
    value: string
  ) {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: value } : c))
    );
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Rule name is required");
      return;
    }

    setSaving(true);

    const ruleInput = {
      name: name.trim(),
      entityType: entityType as "QUOTE" | "DEAL" | "BOOKING",
      description: description.trim() || null,
      isActive,
      priority,
      conditions: conditions.map((c) => ({
        field: c.field,
        operator: c.operator as "equals" | "contains" | "in" | "notIn" | "gt" | "lt" | "gte" | "lte",
        value: c.operator === "in" || c.operator === "notIn"
          ? c.value.split(",").map((v) => v.trim())
          : c.value.trim(),
      })),
    };

    // For create, we pass empty chain steps — they are managed via ChainBuilder
    const chainSteps: ApprovalChainStepInput[] = [];

    if (isNew) {
      const result = await createApprovalRule(ruleInput, chainSteps);
      if (result.success) {
        toast.success("Approval rule created");
        router.push(`/settings/approval-rules/${result.data.id}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } else {
      // When updating rule only, preserve existing chain steps
      const existingSteps = (rule?.approverChain ?? []).map((s) => ({
        order: s.order,
        approverType: s.approverType as "USER" | "ROLE",
        approverId: s.approverId,
        isOptional: s.isOptional,
      }));

      const result = await updateApprovalRule(
        rule!.id,
        ruleInput,
        existingSteps
      );
      if (result.success) {
        toast.success("Approval rule updated");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    }

    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isNew ? "Rule Details" : "Edit Rule Details"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label>Rule Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., High-value deal approval"
          />
        </div>

        {/* Entity Type */}
        <div className="space-y-2">
          <Label>Entity Type</Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="QUOTE">Quote</SelectItem>
              <SelectItem value="DEAL">Deal</SelectItem>
              <SelectItem value="BOOKING">Booking</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe when this rule applies..."
            rows={2}
          />
        </div>

        {/* Priority & Active */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Priority</Label>
            <Input
              type="number"
              min={0}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
            <p className="text-[11px] text-zinc-400">
              Lower values are evaluated first.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Active</Label>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm text-zinc-600">
                {isActive ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Conditions</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addCondition}
              type="button"
            >
              <PlusIcon className="mr-1 size-3" />
              Add
            </Button>
          </div>

          {conditions.length === 0 && (
            <p className="text-xs text-zinc-400">
              No conditions — rule will match all entities of this type.
            </p>
          )}

          {conditions.map((condition, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <Select
                value={condition.field}
                onValueChange={(v) => updateCondition(index, "field", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totalAmount">Total Amount</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="source">Source</SelectItem>
                  <SelectItem value="eventType">Event Type</SelectItem>
                  <SelectItem value="guestCount">Guest Count</SelectItem>
                  <SelectItem value="discount">Discount</SelectItem>
                  <SelectItem value="stage">Stage</SelectItem>
                  <SelectItem value="value">Value</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={condition.operator}
                onValueChange={(v) => updateCondition(index, "operator", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="in">In (comma-sep)</SelectItem>
                  <SelectItem value="notIn">Not In</SelectItem>
                  <SelectItem value="gt">Greater than</SelectItem>
                  <SelectItem value="gte">Greater or equal</SelectItem>
                  <SelectItem value="lt">Less than</SelectItem>
                  <SelectItem value="lte">Less or equal</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={condition.value}
                onChange={(e) => updateCondition(index, "value", e.target.value)}
                placeholder="Value"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeCondition(index)}
                className="text-red-500 hover:text-red-600"
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Save */}
        <Button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="w-full"
        >
          {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {isNew ? "Create Rule" : "Update Rule"}
        </Button>
      </CardContent>
    </Card>
  );
}
