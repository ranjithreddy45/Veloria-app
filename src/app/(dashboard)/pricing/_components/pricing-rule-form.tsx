"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2Icon, CalendarIcon } from "lucide-react";

import {
  pricingRuleSchema,
  type PricingRuleInput,
} from "@/schemas/pricing.schema";
import {
  createPricingRule,
  updatePricingRule,
} from "@/actions/pricing.actions";
import { PRICING_RULE_TYPE_LABELS, DAY_OF_WEEK_LABELS } from "@/lib/constants";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface VenueOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface PricingRuleData {
  id: string;
  name: string;
  ruleType: string;
  multiplier: number;
  conditions: unknown;
  startDate: string | null;
  endDate: string | null;
  dayOfWeek: number | null;
  minDaysAhead: number | null;
  isActive: boolean;
  priority: number;
  venueId: string;
}

interface PricingRuleFormProps {
  rule?: PricingRuleData;
  venues: VenueOption[];
}

// ============================================================
// PricingRuleForm Component
// ============================================================

export function PricingRuleForm({ rule, venues }: PricingRuleFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [startDateOpen, setStartDateOpen] = React.useState(false);
  const [endDateOpen, setEndDateOpen] = React.useState(false);

  const isEditing = !!rule;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<PricingRuleInput>({
    resolver: zodResolver(pricingRuleSchema) as any,
    defaultValues: {
      name: rule?.name ?? "",
      ruleType: (rule?.ruleType ?? undefined) as PricingRuleInput["ruleType"],
      multiplier: rule?.multiplier ?? 1,
      conditions: rule?.conditions ?? undefined,
      startDate: rule?.startDate ? new Date(rule.startDate) : null,
      endDate: rule?.endDate ? new Date(rule.endDate) : null,
      dayOfWeek: rule?.dayOfWeek ?? null,
      minDaysAhead: rule?.minDaysAhead ?? null,
      isActive: rule?.isActive ?? true,
      priority: rule?.priority ?? 0,
      venueId: rule?.venueId ?? "",
    },
  });

  const watchedRuleType = form.watch("ruleType");

  async function onSubmit(data: PricingRuleInput) {
    setIsPending(true);
    try {
      const result = isEditing
        ? await updatePricingRule(rule.id, data)
        : await createPricingRule(data);

      if (result.success) {
        toast.success(
          isEditing
            ? "Pricing rule updated successfully"
            : "Pricing rule created successfully"
        );
        router.push("/pricing");
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
        {/* Section 1: Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Rule Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Rule Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Weekend Premium, Holiday Season Surge"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ruleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select rule type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(PRICING_RULE_TYPE_LABELS).map(
                        ([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="venueId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select venue" />
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section 2: Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing Multiplier</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="multiplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Multiplier *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0.01"
                      max="10"
                      step="0.01"
                      placeholder="e.g., 1.25"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value < 1
                      ? `${Math.round((1 - field.value) * 100)}% discount`
                      : field.value > 1
                        ? `${Math.round((field.value - 1) * 100)}% surcharge`
                        : "No price change"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g., 10"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Rules are applied in ascending priority order
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section 3: Conditions (based on rule type) */}
        {watchedRuleType && (
          <Card>
            <CardHeader>
              <CardTitle>Conditions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {/* SEASONAL: startDate & endDate */}
              {watchedRuleType === "SEASONAL" && (
                <>
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <Popover
                          open={startDateOpen}
                          onOpenChange={setStartDateOpen}
                        >
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "dd MMM yyyy")
                                ) : (
                                  <span>Pick start date</span>
                                )}
                                <CalendarIcon className="ml-auto size-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={
                                field.value
                                  ? new Date(field.value)
                                  : undefined
                              }
                              onSelect={(date) => {
                                field.onChange(date ?? null);
                                setStartDateOpen(false);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <Popover
                          open={endDateOpen}
                          onOpenChange={setEndDateOpen}
                        >
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "dd MMM yyyy")
                                ) : (
                                  <span>Pick end date</span>
                                )}
                                <CalendarIcon className="ml-auto size-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={
                                field.value
                                  ? new Date(field.value)
                                  : undefined
                              }
                              onSelect={(date) => {
                                field.onChange(date ?? null);
                                setEndDateOpen(false);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* DAY_OF_WEEK: dayOfWeek */}
              {watchedRuleType === "DAY_OF_WEEK" && (
                <FormField
                  control={form.control}
                  name="dayOfWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Day of Week</FormLabel>
                      <Select
                        onValueChange={(val) =>
                          field.onChange(parseInt(val))
                        }
                        value={
                          field.value !== null && field.value !== undefined
                            ? String(field.value)
                            : undefined
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(DAY_OF_WEEK_LABELS).map(
                            ([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* EARLY_BIRD / LAST_MINUTE: minDaysAhead */}
              {(watchedRuleType === "EARLY_BIRD" ||
                watchedRuleType === "LAST_MINUTE") && (
                <FormField
                  control={form.control}
                  name="minDaysAhead"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {watchedRuleType === "EARLY_BIRD"
                          ? "Minimum Days Ahead"
                          : "Within Days"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder={
                            watchedRuleType === "EARLY_BIRD"
                              ? "e.g., 30"
                              : "e.g., 7"
                          }
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            field.onChange(
                              val === "" ? null : parseInt(val)
                            );
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {watchedRuleType === "EARLY_BIRD"
                          ? "Discount applies when booked this many days or more in advance"
                          : "Surcharge applies when booked within this many days"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* PEAK_HOUR: info text */}
              {watchedRuleType === "PEAK_HOUR" && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Peak hour rules apply to all time slots by default.
                    The multiplier will be applied when this rule is active.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Section 4: Active Status */}
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4 dark:border-zinc-800">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Enable or disable this pricing rule
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
            {isEditing ? "Update Rule" : "Create Rule"}
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
