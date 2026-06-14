"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { BlueprintTransitionInput } from "@/schemas/blueprint.schema";

// ============================================================
// Status Options by Entity Type
// ============================================================

const LEAD_STATUSES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

const BOOKING_STATUSES = [
  { value: "HOLD", label: "Hold" },
  { value: "TENTATIVE", label: "Tentative" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

// ============================================================
// Required Field Options by Entity Type
// ============================================================

const LEAD_FIELDS = [
  { value: "estimatedValue", label: "Estimated Value" },
  { value: "eventType", label: "Event Type" },
  { value: "eventDate", label: "Event Date" },
  { value: "guestCount", label: "Guest Count" },
  { value: "description", label: "Description" },
  { value: "lostReason", label: "Lost Reason" },
];

const BOOKING_FIELDS = [
  { value: "totalAmount", label: "Total Amount" },
  { value: "eventType", label: "Event Type" },
  { value: "guestCount", label: "Guest Count" },
  { value: "specialRequests", label: "Special Requests" },
  { value: "internalNotes", label: "Internal Notes" },
];

const DEAL_FIELDS = [
  { value: "value", label: "Deal Value" },
  { value: "probability", label: "Probability" },
  { value: "expectedCloseDate", label: "Expected Close Date" },
  { value: "notes", label: "Notes" },
];

// ============================================================
// Required Action Options
// ============================================================

const REQUIRED_ACTIONS = [
  { value: "LOG_COMMUNICATION", label: "Log a Communication" },
  { value: "CREATE_TASK", label: "Create a Task" },
  { value: "SEND_QUOTE", label: "Send a Quote" },
  { value: "CONTRACT_SIGNED", label: "Get Contract Signed" },
];

// ============================================================
// User Role Options
// ============================================================

const USER_ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "SALES_EXEC", label: "Sales Executive" },
  { value: "SALES_HEAD", label: "Sales Head" },
  { value: "EVENT_COORDINATOR", label: "Event Coordinator" },
  { value: "FINANCE", label: "Finance" },
  { value: "STAFF", label: "Staff" },
];

// ============================================================
// Pipeline Stage Type (for DEAL entity type)
// ============================================================

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
}

// ============================================================
// TransitionForm Props
// ============================================================

interface TransitionFormProps {
  entityType: string;
  defaultValues?: BlueprintTransitionInput & { id?: string };
  pipelineStages?: PipelineStage[];
  onSubmit: (data: BlueprintTransitionInput) => Promise<void>;
  isPending: boolean;
  onCancel?: () => void;
}

// ============================================================
// TransitionForm Component
// ============================================================

export function TransitionForm({
  entityType,
  defaultValues,
  pipelineStages,
  onSubmit,
  isPending,
  onCancel,
}: TransitionFormProps) {
  const [fromStatus, setFromStatus] = React.useState(
    defaultValues?.fromStatus ?? ""
  );
  const [toStatus, setToStatus] = React.useState(
    defaultValues?.toStatus ?? ""
  );
  const [name, setName] = React.useState(defaultValues?.name ?? "");
  const [requiredFields, setRequiredFields] = React.useState<string[]>(
    (defaultValues?.requiredFields as string[]) ?? []
  );
  const [requiredActions, setRequiredActions] = React.useState<string[]>(
    (defaultValues?.requiredActions as string[]) ?? []
  );
  const [allowedRoles, setAllowedRoles] = React.useState<string[]>(
    (defaultValues?.allowedRoles as string[]) ?? []
  );
  const [isActive, setIsActive] = React.useState(
    defaultValues?.isActive ?? true
  );
  const [order, setOrder] = React.useState(defaultValues?.order ?? 0);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Determine status options based on entity type
  const statusOptions = React.useMemo(() => {
    if (entityType === "LEAD") return LEAD_STATUSES;
    if (entityType === "BOOKING") return BOOKING_STATUSES;
    if (entityType === "DEAL" && pipelineStages) {
      return pipelineStages.map((s) => ({ value: s.id, label: s.name }));
    }
    return [];
  }, [entityType, pipelineStages]);

  // Determine field options based on entity type
  const fieldOptions = React.useMemo(() => {
    if (entityType === "LEAD") return LEAD_FIELDS;
    if (entityType === "BOOKING") return BOOKING_FIELDS;
    if (entityType === "DEAL") return DEAL_FIELDS;
    return [];
  }, [entityType]);

  const toggleArrayItem = (
    arr: string[],
    item: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter(
      arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item]
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!fromStatus) newErrors.fromStatus = "From status is required";
    if (!toStatus) newErrors.toStatus = "To status is required";
    if (fromStatus && toStatus && fromStatus === toStatus) {
      newErrors.toStatus = "To status must be different from From status";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      fromStatus,
      toStatus,
      name: name.trim() || undefined,
      requiredFields,
      requiredActions,
      allowedRoles,
      isActive,
      order,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {/* From / To Status */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="from-status">From Status *</Label>
          <Select value={fromStatus} onValueChange={setFromStatus} disabled={isPending}>
            <SelectTrigger id="from-status" className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.fromStatus && (
            <p className="text-sm text-destructive">{errors.fromStatus}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="to-status">To Status *</Label>
          <Select value={toStatus} onValueChange={setToStatus} disabled={isPending}>
            <SelectTrigger id="to-status" className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.toStatus && (
            <p className="text-sm text-destructive">{errors.toStatus}</p>
          )}
        </div>
      </div>

      {/* Display Name */}
      <div className="space-y-2">
        <Label htmlFor="transition-name">Display Name</Label>
        <Input
          id="transition-name"
          placeholder="e.g., Qualify Lead, Confirm Booking"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Optional friendly name shown to users when executing this transition.
        </p>
      </div>

      {/* Order */}
      <div className="space-y-2">
        <Label htmlFor="transition-order">Order</Label>
        <Input
          id="transition-order"
          type="number"
          min={0}
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
          disabled={isPending}
        />
      </div>

      <Separator />

      {/* Required Fields */}
      <div className="space-y-3">
        <Label>Required Fields</Label>
        <p className="text-xs text-muted-foreground">
          These fields must be filled before this transition can be executed.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {fieldOptions.map((field) => (
            <label
              key={field.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={requiredFields.includes(field.value)}
                onCheckedChange={() =>
                  toggleArrayItem(requiredFields, field.value, setRequiredFields)
                }
                disabled={isPending}
              />
              <span className="text-sm">{field.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Required Actions */}
      <div className="space-y-3">
        <Label>Required Actions</Label>
        <p className="text-xs text-muted-foreground">
          These actions must be completed before this transition can proceed.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {REQUIRED_ACTIONS.map((action) => (
            <label
              key={action.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={requiredActions.includes(action.value)}
                onCheckedChange={() =>
                  toggleArrayItem(
                    requiredActions,
                    action.value,
                    setRequiredActions
                  )
                }
                disabled={isPending}
              />
              <span className="text-sm">{action.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Allowed Roles */}
      <div className="space-y-3">
        <Label>Allowed Roles</Label>
        <p className="text-xs text-muted-foreground">
          Only users with these roles can execute this transition. Leave empty to
          allow all roles.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {USER_ROLES.map((role) => (
            <label
              key={role.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={allowedRoles.includes(role.value)}
                onCheckedChange={() =>
                  toggleArrayItem(allowedRoles, role.value, setAllowedRoles)
                }
                disabled={isPending}
              />
              <span className="text-sm">{role.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Active Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="transition-active"
          checked={isActive}
          onCheckedChange={setIsActive}
          disabled={isPending}
        />
        <Label htmlFor="transition-active" className="cursor-pointer">
          Active
        </Label>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {defaultValues?.id ? "Update Transition" : "Add Transition"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
