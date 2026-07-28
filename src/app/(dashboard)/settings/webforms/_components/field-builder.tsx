"use client";

import * as React from "react";
import {
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  GripVerticalIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import type { WebformField } from "@/schemas/webform.schema";

// ============================================================
// Field Type Options
// ============================================================

const FIELD_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Dropdown" },
  { value: "TEXTAREA", label: "Text Area" },
] as const;

// ============================================================
// Field Builder Component
// ============================================================

interface FieldBuilderProps {
  fields: WebformField[];
  onChange: (fields: WebformField[]) => void;
}

function generateFieldName(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "field";
}

export function FieldBuilder({ fields, onChange }: FieldBuilderProps) {
  const addField = () => {
    const newField: WebformField = {
      type: "TEXT",
      label: "",
      name: "",
      required: false,
      placeholder: "",
      options: null,
    };
    onChange([...fields, newField]);
  };

  const updateField = (index: number, updates: Partial<WebformField>) => {
    const updated = fields.map((field, i) => {
      if (i !== index) return field;
      const merged = { ...field, ...updates };
      // Auto-generate name from label if label changed and name is empty or was auto-generated
      if (updates.label !== undefined) {
        const autoName = generateFieldName(field.label);
        if (!field.name || field.name === autoName) {
          merged.name = generateFieldName(updates.label);
        }
      }
      return merged;
    });
    onChange(updated);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const updated = [...fields];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          Form Fields ({fields.length})
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <PlusIcon className="mr-2 size-4" />
          Add Field
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No fields yet. Click &quot;Add Field&quot; to start building your form.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <Card key={index} className="relative">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Drag handle / Reorder buttons */}
                <div className="flex flex-col items-center gap-0.5 pt-1">
                  <GripVerticalIcon className="text-muted-foreground size-4" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => moveField(index, "up")}
                    disabled={index === 0}
                    className="size-6"
                  >
                    <ChevronUpIcon className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => moveField(index, "down")}
                    disabled={index === fields.length - 1}
                    className="size-6"
                  >
                    <ChevronDownIcon className="size-3" />
                  </Button>
                </div>

                {/* Field Configuration */}
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {/* Label */}
                    <div>
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={field.label}
                        onChange={(e) =>
                          updateField(index, { label: e.target.value })
                        }
                        placeholder="e.g. Full Name"
                        className="mt-1"
                      />
                    </div>

                    {/* Name */}
                    <div>
                      <Label className="text-xs">Field Name</Label>
                      <Input
                        value={field.name}
                        onChange={(e) =>
                          updateField(index, { name: e.target.value })
                        }
                        placeholder="e.g. full_name"
                        className="mt-1 font-mono text-xs"
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value) =>
                          updateField(index, {
                            type: value as WebformField["type"],
                            // Reset options when switching away from SELECT
                            options:
                              value === "SELECT" ? field.options || [] : null,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Placeholder */}
                    <div>
                      <Label className="text-xs">Placeholder</Label>
                      <Input
                        value={field.placeholder || ""}
                        onChange={(e) =>
                          updateField(index, { placeholder: e.target.value })
                        }
                        placeholder="Placeholder text"
                        className="mt-1"
                      />
                    </div>

                    {/* Required Toggle */}
                    <div className="flex items-center gap-2 pt-5">
                      <Switch
                        checked={field.required}
                        onCheckedChange={(checked) =>
                          updateField(index, { required: checked })
                        }
                      />
                      <Label className="text-xs">Required</Label>
                    </div>
                  </div>

                  {/* Options (for SELECT type) */}
                  {field.type === "SELECT" && (
                    <div>
                      <Label className="text-xs">
                        Options (one per line)
                      </Label>
                      <textarea
                        value={field.options?.join("\n") || ""}
                        onChange={(e) =>
                          updateField(index, {
                            options: e.target.value
                              .split("\n")
                              .filter((o) => o.trim() !== ""),
                          })
                        }
                        placeholder={`Option 1\nOption 2\nOption 3`}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:bg-zinc-800"
                      />
                    </div>
                  )}
                </div>

                {/* Delete button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeField(index)}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {fields.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addField}
          className="w-full"
        >
          <PlusIcon className="mr-2 size-4" />
          Add Another Field
        </Button>
      )}
    </div>
  );
}
