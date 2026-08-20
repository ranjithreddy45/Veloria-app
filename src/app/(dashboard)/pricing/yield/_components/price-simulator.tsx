"use client";

import * as React from "react";
import { Loader2Icon, CalculatorIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { calculateYieldPrice } from "@/actions/yield-pricing.actions";
import {
  YIELD_RULE_TYPE_COLORS,
  YIELD_RULE_TYPE_LABELS,
} from "@/lib/pricing/yield-rule-types";
import {
  PRICING_RULE_TYPE_COLORS,
  PRICING_RULE_TYPE_LABELS,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { BOOKABLE_SLOTS } from "@/lib/sales/slot";
import type { TimeSlotEnum } from "@/lib/sales/slot";
import type { YieldPriceResult } from "@/lib/pricing/yield-engine";

interface VenueOption {
  id: string;
  name: string;
}

interface PriceSimulatorProps {
  venues: VenueOption[];
}

const ALL_COLORS = { ...PRICING_RULE_TYPE_COLORS, ...YIELD_RULE_TYPE_COLORS };
const ALL_LABELS = { ...PRICING_RULE_TYPE_LABELS, ...YIELD_RULE_TYPE_LABELS };

function ruleLabel(type: string): string {
  if (type === "MANUAL_OVERRIDE") return "Manual Override";
  return ALL_LABELS[type] ?? type;
}

export function PriceSimulator({ venues }: PriceSimulatorProps) {
  const [venueId, setVenueId] = React.useState(venues[0]?.id ?? "");
  const [date, setDate] = React.useState("");
  const [timeSlot, setTimeSlot] = React.useState<TimeSlotEnum>("EVENING");
  const [guestCount, setGuestCount] = React.useState("100");
  const [isPending, setIsPending] = React.useState(false);
  const [result, setResult] = React.useState<YieldPriceResult | null>(null);

  async function onSimulate() {
    if (!venueId) {
      toast.error("Select a venue");
      return;
    }
    if (!date) {
      toast.error("Select a date");
      return;
    }
    setIsPending(true);
    try {
      const res = await calculateYieldPrice(
        venueId,
        new Date(date + "T00:00:00.000Z"),
        timeSlot,
        Number(guestCount) || 0
      );
      if (res.success) {
        setResult(res.data);
      } else {
        toast.error(res.error);
        setResult(null);
      }
    } catch {
      toast.error("Failed to simulate price");
      setResult(null);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalculatorIcon className="size-5 text-indigo-500" />
          Price Simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 lg:col-span-2">
            <Label>Venue</Label>
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
          <div className="space-y-2">
            <Label htmlFor="sim-date">Date</Label>
            <Input
              id="sim-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Slot</Label>
            <Select
              value={timeSlot}
              onValueChange={(v) => setTimeSlot(v as TimeSlotEnum)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Slot" />
              </SelectTrigger>
              <SelectContent>
                {BOOKABLE_SLOTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sim-guests">Guests</Label>
            <Input
              id="sim-guests"
              type="number"
              min="0"
              step="1"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={onSimulate} disabled={isPending}>
          {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          Simulate Price
        </Button>

        {result && (
          <div className="space-y-4 rounded-lg border p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Base slot price
              </span>
              <span className="text-sm font-medium">
                {formatINR(result.basePrice)}
              </span>
            </div>

            {result.demandSignal && (
              <div className="flex flex-wrap items-center gap-4 rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Occupancy:{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {result.demandSignal.occupancyPct}%
                  </span>
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Demand:{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {result.demandSignal.demandScore}
                  </span>
                </span>
                {result.demandSignal.source && (
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Source:{" "}
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {result.demandSignal.source}
                    </span>
                  </span>
                )}
              </div>
            )}

            {result.appliedRules.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Applied rules ({result.appliedRules.length})
                </p>
                {result.appliedRules.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusBadge
                        status={r.ruleType}
                        colorMap={ALL_COLORS}
                        label={ruleLabel(r.ruleType)}
                      />
                      <span className="truncate text-zinc-700 dark:text-zinc-300">
                        {r.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ×{r.multiplier}
                      </span>
                    </div>
                    <span className="font-medium">
                      {formatINR(r.priceAfter)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No pricing rules applied — base price used.
              </p>
            )}

            <div className="flex items-center justify-between border-t pt-3 text-sm dark:border-zinc-800">
              <span className="text-zinc-500 dark:text-zinc-400">
                Slot price after rules
              </span>
              <span className="font-medium">
                {formatINR(result.calculatedSlotPrice)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">
                Guest charge
                {result.ratePlanName ? ` (${result.ratePlanName})` : ""} ·{" "}
                {result.guestCount} × {formatINR(result.perGuestRate)}
              </span>
              <span className="font-medium">
                {formatINR(result.guestCharge)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-3 dark:border-zinc-800">
              <span className="font-semibold">Total price</span>
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {formatINR(result.totalPrice)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
