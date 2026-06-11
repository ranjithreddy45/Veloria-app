"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import {
  emailTemplateSchema,
  type EmailTemplateInput,
} from "@/schemas/campaign.schema";
import {
  createEmailTemplate,
  updateEmailTemplate,
} from "@/actions/email-template.actions";
import { EMAIL_TEMPLATE_CATEGORIES } from "@/lib/constants";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// ============================================================
// EmailTemplateForm Props
// ============================================================

interface TemplateData {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  category: string | null;
  isActive: boolean;
}

interface EmailTemplateFormProps {
  template?: TemplateData;
}

// ============================================================
// EmailTemplateForm Component
// ============================================================

export function EmailTemplateForm({ template }: EmailTemplateFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const isEditing = !!template;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<EmailTemplateInput>({
    resolver: zodResolver(emailTemplateSchema) as any,
    defaultValues: {
      name: template?.name ?? "",
      subject: template?.subject ?? "",
      htmlContent: template?.htmlContent ?? "",
      category: template?.category ?? "",
      isActive: template?.isActive ?? true,
    },
  });

  async function onSubmit(data: EmailTemplateInput) {
    setIsPending(true);
    try {
      const result = isEditing
        ? await updateEmailTemplate(template.id, data)
        : await createEmailTemplate(data);

      if (result.success) {
        toast.success(
          isEditing
            ? "Template updated successfully"
            : "Template created successfully"
        );
        router.push("/settings/email-templates");
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
        {/* Template Details */}
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Booking Confirmation"
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
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    value={field.value || "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {EMAIL_TEMPLATE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
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
              name="subject"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Email Subject *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Your Booking is Confirmed!"
                      {...field}
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
                <FormItem className="flex items-center gap-3 sm:col-span-2">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Active</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Template Content */}
        <Card>
          <CardHeader>
            <CardTitle>Email Content</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="htmlContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>HTML Content *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the email HTML content here..."
                      rows={16}
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

        {/* Actions */}
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
