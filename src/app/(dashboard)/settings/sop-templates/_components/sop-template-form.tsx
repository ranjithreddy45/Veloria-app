"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import {
  createSOPTemplateSchema,
  type CreateSOPTemplateInput,
} from "@/schemas/sop-template.schema";
import {
  createSOPTemplate,
  updateSOPTemplate,
} from "@/actions/sop-template.actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

// ============================================================
// Types
// ============================================================

interface SOPTemplateFormData {
  name: string;
  description: string;
  eventType: string;
  isDefault: boolean;
  isActive: boolean;
}

interface SOPTemplateFormProps {
  initialData?: SOPTemplateFormData;
  templateId?: string;
}

// ============================================================
// SOP Template Form Component
// ============================================================

export function SOPTemplateForm({ initialData, templateId }: SOPTemplateFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const isEditing = !!templateId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreateSOPTemplateInput>({
    resolver: zodResolver(createSOPTemplateSchema) as any,
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      eventType: initialData?.eventType ?? "",
      isDefault: initialData?.isDefault ?? false,
    },
  });

  async function onSubmit(data: CreateSOPTemplateInput) {
    setIsPending(true);
    try {
      if (isEditing) {
        const result = await updateSOPTemplate(templateId, {
          name: data.name,
          description: data.description,
          eventType: data.eventType,
          isDefault: data.isDefault,
          isActive: initialData?.isActive,
        });
        if (result.success) {
          toast.success("SOP template updated successfully");
          router.push(`/settings/sop-templates/${templateId}`);
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to update template");
        }
      } else {
        const result = await createSOPTemplate(data);
        if (result.success) {
          toast.success("SOP template created successfully");
          router.push("/settings/sop-templates");
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to create template");
        }
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
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Template Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Wedding Ceremony SOP"
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
                <FormItem className="sm:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the purpose and scope of this SOP template..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Wedding, Corporate Event"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional. Associates this template with a specific event type.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-end">
                  <FormLabel>Default Template</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <span className="text-muted-foreground text-sm">
                      {field.value
                        ? "This is the default template"
                        : "Not the default template"}
                    </span>
                  </div>
                  <FormDescription>
                    The default template is auto-selected when creating execution plans.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Update Template" : "Create Template"}
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
