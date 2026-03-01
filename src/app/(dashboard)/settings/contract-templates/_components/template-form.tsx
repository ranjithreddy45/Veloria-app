"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import {
  contractTemplateSchema,
  type ContractTemplateInput,
} from "@/schemas/contract.schema";
import {
  createContractTemplate,
  updateContractTemplate,
} from "@/actions/contract.actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ============================================================
// Types
// ============================================================

interface TemplateFormProps {
  initialData?: ContractTemplateInput & { id?: string };
  templateId?: string;
}

// ============================================================
// Common Variables
// ============================================================

const COMMON_VARIABLES = [
  "clientName",
  "eventDate",
  "venueName",
  "totalAmount",
  "bookingNumber",
  "signerName",
  "signerEmail",
  "company",
  "email",
  "phone",
];

// ============================================================
// Template Form
// ============================================================

export function TemplateForm({ initialData, templateId }: TemplateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newVariable, setNewVariable] = useState("");

  const isEditing = !!templateId;

  const form = useForm<ContractTemplateInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(contractTemplateSchema) as any,
    defaultValues: initialData ?? {
      name: "",
      description: "",
      content: "",
      variables: [],
      category: "",
      isActive: true,
    },
  });

  const watchedContent = form.watch("content");
  const watchedVariables = form.watch("variables");

  // Auto-detect variables from content
  const detectedVariables = Array.from(
    new Set(
      (watchedContent?.match(/\{\{(\w+)\}\}/g) || []).map((v: string) =>
        v.replace(/\{\{|\}\}/g, "")
      )
    )
  );

  // Insert variable into content
  const insertVariable = (variable: string) => {
    const currentContent = form.getValues("content");
    form.setValue("content", currentContent + `{{${variable}}}`);
  };

  // Add custom variable
  const addVariable = () => {
    const trimmed = newVariable.trim();
    if (!trimmed) return;
    const current = form.getValues("variables");
    if (!current.includes(trimmed)) {
      form.setValue("variables", [...current, trimmed]);
    }
    setNewVariable("");
  };

  // Remove variable
  const removeVariable = (variable: string) => {
    const current = form.getValues("variables");
    form.setValue(
      "variables",
      current.filter((v) => v !== variable)
    );
  };

  // Submit handler
  const onSubmit = (data: ContractTemplateInput) => {
    startTransition(async () => {
      const result = isEditing
        ? await updateContractTemplate(templateId!, data)
        : await createContractTemplate(data);

      if (result.success) {
        toast.success(
          isEditing
            ? "Template updated successfully"
            : "Template created successfully"
        );
        router.push("/settings/contract-templates");
      } else {
        toast.error(result.error || "Something went wrong");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Left: Form Fields */}
          <div className="space-y-6 xl:col-span-2">
            {/* Template Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Template Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Wedding Event Agreement"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Brief description of this template"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Wedding, Corporate, General"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-col justify-end">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <Label>
                            {field.value ? "Active" : "Inactive"}
                          </Label>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Template Content */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Template Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Insert Variables */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Quick insert variable:
                  </Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {COMMON_VARIABLES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariable(v)}
                        className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-mono hover:bg-indigo-50 hover:border-indigo-300 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-indigo-950 dark:hover:border-indigo-600"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={`Enter template content with {{placeholders}}...\n\nExample:\nThis agreement is between Veloria Grand and {{clientName}} for the event on {{eventDate}} at {{venueName}}.`}
                          rows={20}
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Custom Variables */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custom Variables</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Variable name (e.g. customField)"
                    value={newVariable}
                    onChange={(e) => setNewVariable(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addVariable();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addVariable}
                  >
                    <PlusIcon className="mr-1 size-4" />
                    Add
                  </Button>
                </div>

                {watchedVariables.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {watchedVariables.map((v) => (
                      <Badge
                        key={v}
                        variant="secondary"
                        className="font-mono text-xs gap-1"
                      >
                        {`{{${v}}}`}
                        <button
                          type="button"
                          onClick={() => removeVariable(v)}
                          className="ml-1 hover:text-destructive"
                        >
                          <Trash2Icon className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                    ? "Update Template"
                    : "Create Template"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="xl:col-span-1">
            <div className="sticky top-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <SparklesIcon className="size-4" />
                    Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase">
                      Name
                    </div>
                    <div className="font-medium">
                      {form.watch("name") || "Untitled Template"}
                    </div>
                  </div>

                  {form.watch("category") && (
                    <div>
                      <Badge variant="outline" className="text-xs">
                        {form.watch("category")}
                      </Badge>
                    </div>
                  )}

                  <Separator />

                  {/* Detected Variables */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
                      Detected Variables ({detectedVariables.length})
                    </div>
                    {detectedVariables.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {detectedVariables.map((v) => (
                          <Badge
                            key={v}
                            variant="secondary"
                            className="text-xs font-mono"
                          >
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No variables detected. Use {"{{variableName}}"} syntax.
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Content Preview */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
                      Content Preview
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap dark:bg-muted/10">
                      {watchedContent || "No content yet..."}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
