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
    <section className="rounded-2xl border bg-card shadow-card">
      <div className="border-b px-5 py-4">
        <h3 className="text-copy font-semibold tracking-[-0.01em]">
          Rule Details
        </h3>
        <p className="mt-1 text-body text-muted-foreground">
          Name the rule, pick what it watches, and set the conditions that make
          it fire.
        </p>
      </div>

      <div className="space-y-5 px-5 py-5">
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
      </div>

      {/* Behaviour rows — label + helper left, control right */}
      <div className="divide-y border-y">
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div className="min-w-0">
            <Label className="text-sm">Priority</Label>
            <p className="mt-0.5 text-detail text-muted-foreground">
              Lower values are evaluated first.
            </p>
          </div>
          <Input
            type="number"
            min={0}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="numeric w-24 shrink-0 text-right"
          />
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div className="min-w-0">
            <Label className="text-sm">Active</Label>
            <p className="mt-0.5 text-detail text-muted-foreground">
              {isActive
                ? "This rule is live — matching requests will need approval."
                : "Paused. Matching requests go through without approval."}
            </p>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            aria-label="Rule active"
          />
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        {/* Conditions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Conditions</Label>
              <p className="mt-0.5 text-detail text-muted-foreground">
                All conditions must match for the rule to fire.
              </p>
            </div>
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
            <p className="rounded-lg border border-dashed px-3 py-2.5 text-body text-muted-foreground">
              No conditions yet — this rule will match every{" "}
              {entityType.toLowerCase()}.
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
                className="text-destructive hover:text-destructive"
                title="Remove condition"
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end border-t bg-muted/30 px-5 py-3.5">
        <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
          {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {isNew ? "Create Rule" : "Save Changes"}
        </Button>
      </div>
    </section>
  );
}
