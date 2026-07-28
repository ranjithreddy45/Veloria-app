"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import {
  createReferralRewardRule,
  updateReferralRewardRule,
} from "@/actions/referral-engine.actions";

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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Schema
// ============================================================

const formSchema = z.object({
  name: z.string().min(1, "Rule name is required").max(200),
  description: z.string().max(2000).optional(),
  triggerEvent: z.enum(["BOOKING_CONFIRMED", "HIGH_VALUE_BOOKING", "REPEAT_REFERRAL"]),
  rewardType: z.enum(["POINTS", "CASH", "DISCOUNT"]),
  rewardValue: z.coerce.number().positive("Reward value must be positive"),
  minBookingValue: z.coerce.number().positive().optional().or(z.literal(0)).or(z.literal(undefined)),
  bonusMultiplier: z.coerce.number().positive().optional().or(z.literal(0)).or(z.literal(undefined)),
  tierLevel: z.coerce.number().int().min(1, "Tier must be at least 1").default(1),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ============================================================
// Props
// ============================================================

interface ReferralRuleFormProps {
  initialData?: {
    id: string;
    name: string;
    description: string;
    triggerEvent: "BOOKING_CONFIRMED" | "HIGH_VALUE_BOOKING" | "REPEAT_REFERRAL";
    rewardType: "POINTS" | "CASH" | "DISCOUNT";
    rewardValue: number;
    minBookingValue?: number;
    bonusMultiplier?: number;
    tierLevel: number;
    isActive: boolean;
  };
}

// ============================================================
// ReferralRuleForm Component
// ============================================================

export function ReferralRuleForm({ initialData }: ReferralRuleFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const isEditing = !!initialData?.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      triggerEvent: initialData?.triggerEvent || "BOOKING_CONFIRMED",
      rewardType: initialData?.rewardType || "CASH",
      rewardValue: initialData?.rewardValue || 0,
      minBookingValue: initialData?.minBookingValue || undefined,
      bonusMultiplier: initialData?.bonusMultiplier || undefined,
      tierLevel: initialData?.tierLevel || 1,
      isActive: initialData?.isActive ?? true,
    },
  });

  async function onSubmit(values: FormValues) {
    setIsPending(true);
    try {
      const payload = {
        name: values.name,
        description: values.description || "",
        triggerEvent: values.triggerEvent,
        rewardType: values.rewardType,
        rewardValue: values.rewardValue,
        minBookingValue:
          values.minBookingValue && values.minBookingValue > 0
            ? values.minBookingValue
            : null,
        bonusMultiplier:
          values.bonusMultiplier && values.bonusMultiplier > 0
            ? values.bonusMultiplier
            : null,
        tierLevel: values.tierLevel,
      };

      if (isEditing && initialData) {
        const result = await updateReferralRewardRule(initialData.id, {
          ...payload,
          isActive: values.isActive,
        });
        if (result.success) {
          toast.success("Rule updated successfully");
          router.push("/settings/referral-rules");
          router.refresh();
        } else {
          toast.error(result.error || "Failed to update rule");
        }
      } else {
        const result = await createReferralRewardRule(payload);
        if (result.success) {
          toast.success("Rule created successfully");
          router.push("/settings/referral-rules");
          router.refresh();
        } else {
          toast.error(result.error || "Failed to create rule");
        }
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle>
          {isEditing ? "Edit Rule" : "Create Rule"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Standard Booking Reward"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe when this rule applies"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Trigger Event */}
            <FormField
              control={form.control}
              name="triggerEvent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trigger Event</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trigger" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="BOOKING_CONFIRMED">
                        Booking Confirmed
                      </SelectItem>
                      <SelectItem value="HIGH_VALUE_BOOKING">
                        High-Value Booking
                      </SelectItem>
                      <SelectItem value="REPEAT_REFERRAL">
                        Repeat Referral
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reward Type & Value */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="rewardType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reward Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="POINTS">Points</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="DISCOUNT">Discount (%)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rewardValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reward Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="e.g. 500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Min Booking Value */}
            <FormField
              control={form.control}
              name="minBookingValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Min Booking Value (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="e.g. 100000"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bonus Multiplier & Tier Level */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="bonusMultiplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bonus Multiplier (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="e.g. 1.5"
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
                name="tierLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tier Level</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Is Active (edit only) */}
            {isEditing && (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <FormLabel className="text-base">Active</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        When disabled, this rule will not trigger rewards.
                      </p>
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
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/settings/referral-rules")}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                {isEditing ? "Update Rule" : "Create Rule"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
