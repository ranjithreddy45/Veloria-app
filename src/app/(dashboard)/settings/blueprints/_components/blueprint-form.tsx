"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

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
import type { BlueprintInput } from "@/schemas/blueprint.schema";

// ============================================================
// Entity Type Options
// ============================================================

const ENTITY_TYPE_OPTIONS = [
  { value: "LEAD", label: "Lead" },
  { value: "DEAL", label: "Deal" },
  { value: "BOOKING", label: "Booking" },
];

// ============================================================
// BlueprintForm Props
// ============================================================

interface BlueprintFormProps {
  defaultValues?: BlueprintInput;
  onSubmit: (data: BlueprintInput) => Promise<void>;
  isPending: boolean;
  onCancel?: () => void;
  submitLabel?: string;
}

// ============================================================
// BlueprintForm Component
// ============================================================

export function BlueprintForm({
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
  submitLabel,
}: BlueprintFormProps) {
  const [name, setName] = React.useState(defaultValues?.name ?? "");
  const [entityType, setEntityType] = React.useState<string>(
    defaultValues?.entityType ?? ""
  );
  const [description, setDescription] = React.useState(
    defaultValues?.description ?? ""
  );
  const [isActive, setIsActive] = React.useState(
    defaultValues?.isActive ?? true
  );
  const [isPublished, setIsPublished] = React.useState(
    defaultValues?.isPublished ?? false
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Blueprint name is required";
    if (name.length > 100)
      newErrors.name = "Name must be at most 100 characters";
    if (!entityType) newErrors.entityType = "Entity type is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      name: name.trim(),
      entityType: entityType as "LEAD" | "DEAL" | "BOOKING",
      description: description.trim() || undefined,
      isActive,
      isPublished,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="blueprint-name">Blueprint Name *</Label>
        <Input
          id="blueprint-name"
          placeholder="e.g., Lead Qualification Process"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      {/* Entity Type */}
      <div className="space-y-2">
        <Label htmlFor="entity-type">Entity Type *</Label>
        <Select
          value={entityType}
          onValueChange={setEntityType}
          disabled={isPending || !!defaultValues?.entityType}
        >
          <SelectTrigger id="entity-type" className="w-full">
            <SelectValue placeholder="Select entity type" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.entityType && (
          <p className="text-sm text-destructive">{errors.entityType}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="blueprint-description">Description</Label>
        <Textarea
          id="blueprint-description"
          placeholder="Describe the purpose of this blueprint..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
          rows={3}
        />
      </div>

      {/* Active & Published Toggles */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id="blueprint-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            disabled={isPending}
          />
          <Label htmlFor="blueprint-active" className="cursor-pointer">
            Active
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="blueprint-published"
            checked={isPublished}
            onCheckedChange={setIsPublished}
            disabled={isPending}
          />
          <Label htmlFor="blueprint-published" className="cursor-pointer">
            Published
          </Label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {submitLabel ?? (defaultValues ? "Update Blueprint" : "Create Blueprint")}
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
