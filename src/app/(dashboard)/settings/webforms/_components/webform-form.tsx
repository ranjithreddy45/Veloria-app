"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { FieldBuilder } from "./field-builder";
import { createWebform, updateWebform } from "@/actions/webform.actions";
import type { WebformField, WebformInput } from "@/schemas/webform.schema";

// ============================================================
// Lead Source Options
// ============================================================

const LEAD_SOURCE_OPTIONS = [
  { value: "WEBSITE", label: "Website" },
  { value: "REFERRAL", label: "Referral" },
  { value: "SOCIAL_MEDIA", label: "Social Media" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PHONE_INQUIRY", label: "Phone Inquiry" },
  { value: "EMAIL", label: "Email" },
  { value: "EVENT", label: "Event" },
  { value: "PARTNER", label: "Partner" },
  { value: "ADVERTISEMENT", label: "Advertisement" },
  { value: "OTHER", label: "Other" },
];

// ============================================================
// Webform Form Component
// ============================================================

interface WebformFormProps {
  mode: "create" | "edit";
  webformId?: string;
  defaultValues?: Partial<WebformInput>;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function WebformForm({
  mode,
  webformId,
  defaultValues,
}: WebformFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [name, setName] = React.useState(defaultValues?.name || "");
  const [slug, setSlug] = React.useState(defaultValues?.slug || "");
  const [description, setDescription] = React.useState(
    defaultValues?.description || ""
  );
  const [fields, setFields] = React.useState<WebformField[]>(
    defaultValues?.fields || [
      { type: "TEXT", label: "Full Name", name: "name", required: true, placeholder: "Enter your name" },
      { type: "EMAIL", label: "Email", name: "email", required: true, placeholder: "Enter your email" },
      { type: "PHONE", label: "Phone", name: "phone", required: false, placeholder: "Enter your phone number" },
      { type: "TEXTAREA", label: "Message", name: "message", required: false, placeholder: "Your message..." },
    ]
  );
  const [thankYouUrl, setThankYouUrl] = React.useState(
    defaultValues?.thankYouUrl || ""
  );
  const [thankYouMessage, setThankYouMessage] = React.useState(
    defaultValues?.thankYouMessage || ""
  );
  const [defaultSource, setDefaultSource] = React.useState<string>(
    defaultValues?.defaultSource || "WEBSITE"
  );
  const [honeypotField, setHoneypotField] = React.useState(
    defaultValues?.honeypotField || "website_url"
  );
  const [isActive, setIsActive] = React.useState(
    defaultValues?.isActive ?? true
  );
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(
    mode === "edit"
  );

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data: WebformInput = {
        name,
        slug,
        description,
        fields,
        thankYouUrl,
        thankYouMessage,
        notifyUserIds: [],
        autoAssignTo: "",
        defaultSource: defaultSource as WebformInput["defaultSource"],
        honeypotField,
        isActive,
      };

      const result =
        mode === "create"
          ? await createWebform(data)
          : await updateWebform(webformId!, data);

      if (result.success) {
        toast.success(
          mode === "create"
            ? "Webform created successfully"
            : "Webform updated successfully"
        );
        if (mode === "create") {
          router.push(`/settings/webforms/${result.data.id}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Form Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Contact Form"
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="slug">URL Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="e.g. contact-form"
            className="mt-1 font-mono text-sm"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            /form/{slug || "your-slug"}
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the form..."
          className="mt-1"
          rows={2}
        />
      </div>

      {/* Field Builder */}
      <div className="border-t pt-6">
        <FieldBuilder fields={fields} onChange={setFields} />
      </div>

      {/* Settings */}
      <div className="space-y-4 border-t pt-6">
        <h3 className="text-sm font-semibold">Settings</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="defaultSource">Default Lead Source</Label>
            <Select value={defaultSource} onValueChange={setDefaultSource}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="honeypotField">Honeypot Field Name</Label>
            <Input
              id="honeypotField"
              value={honeypotField}
              onChange={(e) => setHoneypotField(e.target.value)}
              placeholder="e.g. website_url"
              className="mt-1"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Hidden anti-spam field. Leave empty to disable.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="thankYouMessage">Thank You Message</Label>
            <Textarea
              id="thankYouMessage"
              value={thankYouMessage}
              onChange={(e) => setThankYouMessage(e.target.value)}
              placeholder="Thank you for your submission!"
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="thankYouUrl">Redirect URL (optional)</Label>
            <Input
              id="thankYouUrl"
              value={thankYouUrl}
              onChange={(e) => setThankYouUrl(e.target.value)}
              placeholder="https://example.com/thank-you"
              className="mt-1"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Redirect to this URL after submission instead of showing message.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>Form is active and accepting submissions</Label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create Webform"
              : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
