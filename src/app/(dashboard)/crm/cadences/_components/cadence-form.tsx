"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import type { CadenceInput, ExitCriterion } from "@/schemas/cadence.schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

// ============================================================
// Lead statuses for STATUS_CHANGE criteria
// ============================================================

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
];

// ============================================================
// Props
// ============================================================

interface CadenceFormProps {
  defaultValues?: CadenceInput;
  onSubmit: (data: CadenceInput) => void;
  loading?: boolean;
  onCancel?: () => void;
}

// ============================================================
// Component
// ============================================================

export function CadenceForm({
  defaultValues,
  onSubmit,
  loading,
  onCancel,
}: CadenceFormProps) {
  const [name, setName] = React.useState(defaultValues?.name ?? "");
  const [description, setDescription] = React.useState(
    defaultValues?.description ?? ""
  );
  const [entityType, setEntityType] = React.useState<"LEAD" | "CONTACT">(
    (defaultValues?.entityType as "LEAD" | "CONTACT") ?? "LEAD"
  );
  const [exitCriteria, setExitCriteria] = React.useState<ExitCriterion[]>(
    (defaultValues?.exitCriteria as ExitCriterion[]) ?? []
  );
  const [autoEnroll, setAutoEnroll] = React.useState(
    defaultValues?.autoEnroll ?? false
  );

  // ---- Exit Criteria Handlers ----
  function addExitCriterion() {
    setExitCriteria((prev) => [
      ...prev,
      { type: "STATUS_CHANGE", values: [] },
    ]);
  }

  function removeExitCriterion(index: number) {
    setExitCriteria((prev) => prev.filter((_, i) => i !== index));
  }

  function updateExitCriterionType(
    index: number,
    type: "STATUS_CHANGE" | "REPLY_RECEIVED"
  ) {
    setExitCriteria((prev) =>
      prev.map((c, i) => (i === index ? { ...c, type, values: [] } : c))
    );
  }

  function toggleExitCriterionValue(index: number, value: string) {
    setExitCriteria((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const values = c.values.includes(value)
          ? c.values.filter((v) => v !== value)
          : [...c.values, value];
        return { ...c, values };
      })
    );
  }

  // ---- Submit ----
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      description: description || undefined,
      entityType,
      exitCriteria,
      autoEnroll,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="cadence-name">Name *</Label>
        <Input
          id="cadence-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., New Lead Follow-up"
          maxLength={100}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="cadence-description">Description</Label>
        <textarea
          id="cadence-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this cadence..."
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          rows={3}
        />
      </div>

      {/* Entity Type */}
      <div className="space-y-1.5">
        <Label>Entity Type</Label>
        <Select
          value={entityType}
          onValueChange={(v) => setEntityType(v as "LEAD" | "CONTACT")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LEAD">Lead</SelectItem>
            <SelectItem value="CONTACT">Contact</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Exit Criteria */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Exit Criteria</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addExitCriterion}
          >
            <PlusIcon className="mr-1 h-3 w-3" />
            Add Criteria
          </Button>
        </div>

        {exitCriteria.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No exit criteria defined. Enrollments will only end when all steps
            are completed or manually stopped.
          </p>
        )}

        {exitCriteria.map((criterion, index) => (
          <div
            key={index}
            className="rounded-md border p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <Select
                value={criterion.type}
                onValueChange={(v) =>
                  updateExitCriterionType(
                    index,
                    v as "STATUS_CHANGE" | "REPLY_RECEIVED"
                  )
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STATUS_CHANGE">Status Change</SelectItem>
                  <SelectItem value="REPLY_RECEIVED">Reply Received</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeExitCriterion(index)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            {criterion.type === "STATUS_CHANGE" && (
              <div className="space-y-1">
                <Label className="text-xs">Exit when status becomes:</Label>
                <div className="flex flex-wrap gap-1.5">
                  {LEAD_STATUSES.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={
                        criterion.values.includes(status)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        toggleExitCriterionValue(index, status)
                      }
                    >
                      {status.replace(/_/g, " ")}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {criterion.type === "REPLY_RECEIVED" && (
              <p className="text-muted-foreground text-xs">
                Enrollment will exit when an inbound communication is received
                from the contact.
              </p>
            )}
          </div>
        ))}
      </div>

      <Separator />

      {/* Auto-Enroll */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Auto-Enroll</Label>
          <p className="text-muted-foreground text-xs">
            Automatically enroll new leads/contacts matching criteria
          </p>
        </div>
        <Switch checked={autoEnroll} onCheckedChange={setAutoEnroll} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading
            ? "Saving..."
            : defaultValues
              ? "Update Cadence"
              : "Create Cadence"}
        </Button>
      </div>
    </form>
  );
}
