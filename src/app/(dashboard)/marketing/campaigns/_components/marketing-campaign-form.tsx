"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import {
  marketingCampaignSchema,
  type MarketingCampaignInput,
} from "@/schemas/attribution.schema";
import {
  createMarketingCampaign,
  updateMarketingCampaign,
} from "@/actions/marketing-campaign.actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Common event-marketing channels (free string — match your spend imports).
const CHANNEL_SUGGESTIONS = [
  "GOOGLE_ADS",
  "FACEBOOK_ADS",
  "INSTAGRAM",
  "WEDMEGOOD",
  "JUSTDIAL",
  "INDIAMART",
  "REFERRAL",
  "ORGANIC",
  "EMAIL",
];

interface CampaignData {
  id: string;
  name: string;
  channel: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  spendToDate: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  notes: string | null;
}

interface MarketingCampaignFormProps {
  campaign?: CampaignData;
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function MarketingCampaignForm({ campaign }: MarketingCampaignFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const isEditing = !!campaign;

  const form = useForm<MarketingCampaignInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(marketingCampaignSchema) as any,
    defaultValues: {
      name: campaign?.name ?? "",
      channel: campaign?.channel ?? "",
      utmSource: campaign?.utmSource ?? "",
      utmMedium: campaign?.utmMedium ?? "",
      utmCampaign: campaign?.utmCampaign ?? "",
      spendToDate: campaign?.spendToDate ?? 0,
      currency: campaign?.currency ?? "INR",
      startDate: toDateInput(campaign?.startDate),
      endDate: toDateInput(campaign?.endDate),
      isActive: campaign?.isActive ?? true,
      notes: campaign?.notes ?? "",
    },
  });

  async function onSubmit(data: MarketingCampaignInput) {
    setIsPending(true);
    try {
      const result = isEditing
        ? await updateMarketingCampaign(campaign.id, data)
        : await createMarketingCampaign(data);

      if (result.success) {
        toast.success(
          isEditing ? "Campaign updated" : "Campaign created"
        );
        router.push("/marketing/campaigns");
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
        <Card>
          <CardHeader>
            <CardTitle>Campaign details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Diwali Wedding Push 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. GOOGLE_ADS"
                      list="marketing-channels"
                      {...field}
                    />
                  </FormControl>
                  <datalist id="marketing-channels">
                    {CHANNEL_SUGGESTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <FormDescription>
                    Free text; align with your lead-source labels.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input placeholder="INR" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>UTM mapping</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="utmSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>utm_source</FormLabel>
                  <FormControl>
                    <Input placeholder="google" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="utmMedium"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>utm_medium</FormLabel>
                  <FormControl>
                    <Input placeholder="cpc" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="utmCampaign"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>utm_campaign</FormLabel>
                  <FormControl>
                    <Input placeholder="diwali_2026" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormDescription>
                    One campaign should own a given utm_campaign string.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spend & period</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="spendToDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Spend to date</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...field}
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-xl border border-border/70 p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Only active campaigns are matched when attributing new leads.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Internal notes about this campaign..."
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

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Update Campaign" : "Create Campaign"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
