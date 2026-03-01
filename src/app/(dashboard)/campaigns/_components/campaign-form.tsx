"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { campaignSchema, type CampaignInput } from "@/schemas/campaign.schema";
import { createCampaign, updateCampaign } from "@/actions/campaign.actions";
import { EVENT_TYPES } from "@/lib/constants";

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

// ============================================================
// CampaignForm Props
// ============================================================

interface CampaignData {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  recipientFilter: { eventType?: string; contactType?: string } | null;
  scheduledAt: string | null;
}

interface CampaignFormProps {
  campaign?: CampaignData;
}

// ============================================================
// CampaignForm Component
// ============================================================

export function CampaignForm({ campaign }: CampaignFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const isEditing = !!campaign;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CampaignInput>({
    resolver: zodResolver(campaignSchema) as any,
    defaultValues: {
      name: campaign?.name ?? "",
      subject: campaign?.subject ?? "",
      htmlContent: campaign?.htmlContent ?? "",
      recipientFilter: campaign?.recipientFilter ?? {
        eventType: "",
        contactType: "",
      },
      scheduledAt: campaign?.scheduledAt
        ? new Date(campaign.scheduledAt).toISOString().slice(0, 16)
        : "",
    },
  });

  async function onSubmit(data: CampaignInput) {
    setIsPending(true);
    try {
      // Clean up empty filter fields
      const cleanedData = {
        ...data,
        recipientFilter:
          data.recipientFilter?.eventType || data.recipientFilter?.contactType
            ? data.recipientFilter
            : null,
        scheduledAt: data.scheduledAt || null,
      };

      const result = isEditing
        ? await updateCampaign(campaign.id, cleanedData)
        : await createCampaign(cleanedData);

      if (result.success) {
        toast.success(
          isEditing
            ? "Campaign updated successfully"
            : "Campaign created successfully"
        );
        router.push(
          isEditing ? `/campaigns/${campaign.id}` : "/campaigns"
        );
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
        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Campaign Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Summer Wedding Promotion"
                      {...field}
                    />
                  </FormControl>
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
                      placeholder="e.g. Exclusive Summer Wedding Packages!"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Email Content */}
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
                      rows={12}
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

        {/* Recipient Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Recipient Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="recipientFilter.eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All event types" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">All Event Types</SelectItem>
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
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
              name="recipientFilter.contactType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All contacts" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">All Contacts</SelectItem>
                      <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                      <SelectItem value="CORPORATE">Corporate</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Scheduling */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="scheduledAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schedule Date & Time</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      value={field.value ?? ""}
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
            {isEditing ? "Update Campaign" : "Create Campaign"}
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
