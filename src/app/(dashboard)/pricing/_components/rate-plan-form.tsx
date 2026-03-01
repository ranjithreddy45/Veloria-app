"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import {
  ratePlanSchema,
  type RatePlanInput,
} from "@/schemas/pricing.schema";
import {
  createRatePlan,
  updateRatePlan,
} from "@/actions/pricing.actions";

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
  FormDescription,
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
// Types
// ============================================================

interface VenueOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface RatePlanData {
  id: string;
  name: string;
  description: string | null;
  baseRate: number;
  perGuestRate: number;
  isDefault: boolean;
  isActive: boolean;
  venueId: string | null;
}

interface RatePlanFormProps {
  plan?: RatePlanData;
  venues: VenueOption[];
}

// ============================================================
// RatePlanForm Component
// ============================================================

export function RatePlanForm({ plan, venues }: RatePlanFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const isEditing = !!plan;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<RatePlanInput>({
    resolver: zodResolver(ratePlanSchema) as any,
    defaultValues: {
      name: plan?.name ?? "",
      description: plan?.description ?? "",
      baseRate: plan?.baseRate ?? 0,
      perGuestRate: plan?.perGuestRate ?? 0,
      isDefault: plan?.isDefault ?? false,
      isActive: plan?.isActive ?? true,
      venueId: plan?.venueId ?? "",
    },
  });

  async function onSubmit(data: RatePlanInput) {
    setIsPending(true);
    try {
      const result = isEditing
        ? await updateRatePlan(plan.id, data)
        : await createRatePlan(data);

      if (result.success) {
        toast.success(
          isEditing
            ? "Rate plan updated successfully"
            : "Rate plan created successfully"
        );
        router.push("/pricing/rate-plans");
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
        {/* Section 1: Plan Details */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Plan Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Standard Plan, Premium Weekday"
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
                      placeholder="Brief description of this rate plan..."
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
              name="venueId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All venues (global)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {venues
                        .filter((v) => v.isActive)
                        .map((venue) => (
                          <SelectItem key={venue.id} value={venue.id}>
                            {venue.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Leave empty to apply globally to all venues
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section 2: Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="baseRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Rate (INR) *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                        ₹
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g., 100000"
                        className="pl-7"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Base rate for the plan
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="perGuestRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Per Guest Rate (INR) *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                        ₹
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g., 1500"
                        className="pl-7"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Additional charge per guest for the booking
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section 3: Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4 dark:border-zinc-800">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Default Plan</FormLabel>
                    <FormDescription>
                      Make this the default rate plan for the selected venue
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
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4 dark:border-zinc-800">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Enable or disable this rate plan
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
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            )}
            {isEditing ? "Update Plan" : "Create Plan"}
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
