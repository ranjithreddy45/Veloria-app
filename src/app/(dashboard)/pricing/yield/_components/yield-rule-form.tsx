"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import {
  createPricingRule,
  updatePricingRule,
} from "@/actions/pricing.actions";
import {
  yieldRuleTypeValues,
  yieldPricingRuleConditionsSchema,
  type YieldRuleType,
} from "@/schemas/yield-pricing.schema";
import { YIELD_RULE_TYPE_LABELS } from "@/lib/pricing/yield-rule-types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
}

interface YieldRuleData {
  id: string;
  name: string;
  ruleType: string;
  multiplier: number;
  conditions: unknown;
  isActive: boolean;
  priority: number;
  venueId: string;
}

interface YieldRuleFormProps {
  rule?: YieldRuleData;
  venues: VenueOption[];
}

type Conditions = {
  minOccupancyPct?: number | null;
  maxOccupancyPct?: number | null;
  minDemandScore?: number | null;
  maxDemandScore?: number | null;
  minLeadDays?: number | null;
  maxLeadDays?: number | null;
};

function readCond(conditions: unknown): Conditions {
  if (conditions && typeof conditions === "object") {
    return conditions as Conditions;
  }
  return {};
}

function toNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ============================================================
// YieldRuleForm
// ============================================================

export function YieldRuleForm({ rule, venues }: YieldRuleFormProps) {
  const router = useRouter();
  const isEditing = !!rule;
  const [isPending, setIsPending] = React.useState(false);

  const initialCond = readCond(rule?.conditions);

  const [name, setName] = React.useState(rule?.name ?? "");
  const [ruleType, setRuleType] = React.useState<YieldRuleType | "">(
    (rule?.ruleType as YieldRuleType) ?? ""
  );
  const [venueId, setVenueId] = React.useState(rule?.venueId ?? "");
  const [multiplier, setMultiplier] = React.useState(
    rule?.multiplier !== undefined ? String(rule.multiplier) : "1"
  );
  const [priority, setPriority] = React.useState(
    rule?.priority !== undefined ? String(rule.priority) : "0"
  );
  const [isActive, setIsActive] = React.useState(rule?.isActive ?? true);

  // Per-type band fields.
  const [minOcc, setMinOcc] = React.useState(
    initialCond.minOccupancyPct != null ? String(initialCond.minOccupancyPct) : ""
  );
  const [maxOcc, setMaxOcc] = React.useState(
    initialCond.maxOccupancyPct != null ? String(initialCond.maxOccupancyPct) : ""
  );
  const [minDem, setMinDem] = React.useState(
    initialCond.minDemandScore != null ? String(initialCond.minDemandScore) : ""
  );
  const [maxDem, setMaxDem] = React.useState(
    initialCond.maxDemandScore != null ? String(initialCond.maxDemandScore) : ""
  );
  const [minLead, setMinLead] = React.useState(
    initialCond.minLeadDays != null ? String(initialCond.minLeadDays) : ""
  );
  const [maxLead, setMaxLead] = React.useState(
    initialCond.maxLeadDays != null ? String(initialCond.maxLeadDays) : ""
  );

  function buildConditions(type: YieldRuleType): Conditions {
    switch (type) {
      case "OCCUPANCY":
        return { minOccupancyPct: toNum(minOcc), maxOccupancyPct: toNum(maxOcc) };
      case "DEMAND":
        return { minDemandScore: toNum(minDem), maxDemandScore: toNum(maxDem) };
      case "LEAD_TIME":
        return { minLeadDays: toNum(minLead), maxLeadDays: toNum(maxLead) };
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    if (!ruleType) {
      toast.error("Rule type is required");
      return;
    }
    if (!venueId) {
      toast.error("Venue is required");
      return;
    }
    const multNum = Number(multiplier);
    if (!Number.isFinite(multNum) || multNum <= 0 || multNum > 10) {
      toast.error("Multiplier must be between 0 and 10");
      return;
    }

    const conditions = buildConditions(ruleType);
    const condSchema = yieldPricingRuleConditionsSchema(ruleType);
    const parsed = condSchema.safeParse(conditions);
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? "Invalid condition values"
      );
      return;
    }

    setIsPending(true);
    try {
      const payload = {
        name: name.trim(),
        ruleType: ruleType as unknown as "SEASONAL", // PricingRuleType — yield values appended centrally
        multiplier: multNum,
        conditions: parsed.data,
        startDate: null,
        endDate: null,
        dayOfWeek: null,
        minDaysAhead: null,
        isActive,
        priority: Number(priority) || 0,
        venueId,
      };

      const result = isEditing
        ? await updatePricingRule(rule.id, payload)
        : await createPricingRule(payload);

      if (result.success) {
        toast.success(
          isEditing ? "Yield rule updated" : "Yield rule created"
        );
        router.push("/pricing/yield");
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
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rule Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Rule Name *</Label>
            <Input
              id="name"
              placeholder="e.g., High Occupancy Surge, Last-Minute Fill"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Rule Type *</Label>
            <Select
              value={ruleType}
              onValueChange={(v) => setRuleType(v as YieldRuleType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select rule type" />
              </SelectTrigger>
              <SelectContent>
                {yieldRuleTypeValues.map((t) => (
                  <SelectItem key={t} value={t}>
                    {YIELD_RULE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Venue *</Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Multiplier</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="multiplier">Multiplier *</Label>
            <Input
              id="multiplier"
              type="number"
              min="0.01"
              max="10"
              step="0.01"
              placeholder="e.g., 1.25"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {Number(multiplier) < 1
                ? `${Math.round((1 - Number(multiplier)) * 100)}% discount`
                : Number(multiplier) > 1
                  ? `${Math.round((Number(multiplier) - 1) * 100)}% surcharge`
                  : "No price change"}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              min="0"
              step="1"
              placeholder="e.g., 10"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Rules apply in ascending priority order (multipliers stack).
            </p>
          </div>
        </CardContent>
      </Card>

      {ruleType && (
        <Card>
          <CardHeader>
            <CardTitle>Band (when the rule fires)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {ruleType === "OCCUPANCY" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="minOcc">Min Occupancy %</Label>
                  <Input
                    id="minOcc"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="0"
                    value={minOcc}
                    onChange={(e) => setMinOcc(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxOcc">Max Occupancy %</Label>
                  <Input
                    id="maxOcc"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="100"
                    value={maxOcc}
                    onChange={(e) => setMaxOcc(e.target.value)}
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:col-span-2">
                  Applies when the venue/date/slot occupancy falls inside this
                  band. Leave blank for fully open (0–100%).
                </p>
              </>
            )}

            {ruleType === "DEMAND" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="minDem">Min Demand Score</Label>
                  <Input
                    id="minDem"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="0"
                    value={minDem}
                    onChange={(e) => setMinDem(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxDem">Max Demand Score</Label>
                  <Input
                    id="maxDem"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="100"
                    value={maxDem}
                    onChange={(e) => setMaxDem(e.target.value)}
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:col-span-2">
                  Applies when the composite demand index falls inside this band
                  (0–100). Leave blank for fully open.
                </p>
              </>
            )}

            {ruleType === "LEAD_TIME" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="minLead">Min Days Ahead</Label>
                  <Input
                    id="minLead"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="(open)"
                    value={minLead}
                    onChange={(e) => setMinLead(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLead">Max Days Ahead</Label>
                  <Input
                    id="maxLead"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="(open)"
                    value={maxLead}
                    onChange={(e) => setMaxLead(e.target.value)}
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:col-span-2">
                  Applies when the booking lead time (days ahead) falls inside
                  this band. e.g. 0–7 for a last-minute discount; 90+ leave max
                  blank for early-bird.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4 dark:border-zinc-800">
            <div className="space-y-0.5">
              <Label className="text-base">Active</Label>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Enable or disable this yield rule
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {isEditing ? "Update Rule" : "Create Rule"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
