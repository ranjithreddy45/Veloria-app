"use client";

import * as React from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  BuildingIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  NetworkIcon,
  CalendarIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { getCoordinatedSchedule } from "@/actions/multi-venue.actions";

// ============================================================
// Types
// ============================================================

interface VenueOption {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
}

interface SlotAvailability {
  available: boolean;
  reason: string | null;
}

interface VenueSchedule {
  venueId: string;
  venueName: string;
  capacity: number;
  isActive: boolean;
  slots: {
    MORNING: SlotAvailability;
    AFTERNOON: SlotAvailability;
    EVENING: SlotAvailability;
    FULL_DAY: SlotAvailability;
  };
}

interface MultiVenueSelectorProps {
  venues: VenueOption[];
  onSelectionChange: (data: {
    enabled: boolean;
    venueIds: string[];
    venueGroupId: string | null;
  }) => void;
  defaultEnabled?: boolean;
  defaultVenueIds?: string[];
  defaultVenueGroupId?: string | null;
}

// ============================================================
// Generate CUID-like ID
// ============================================================

function generateGroupId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `mvg_${timestamp}${random}`;
}

// ============================================================
// Time Slot Labels
// ============================================================

const SLOT_LABELS: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  FULL_DAY: "Full Day",
};

// ============================================================
// MultiVenueSelector Component
// ============================================================

export function MultiVenueSelector({
  venues,
  onSelectionChange,
  defaultEnabled = false,
  defaultVenueIds = [],
  defaultVenueGroupId = null,
}: MultiVenueSelectorProps) {
  const [enabled, setEnabled] = React.useState(defaultEnabled);
  const [selectedVenueIds, setSelectedVenueIds] =
    React.useState<string[]>(defaultVenueIds);
  const [venueGroupId] = React.useState<string | null>(
    defaultVenueGroupId || (defaultEnabled ? generateGroupId() : null)
  );
  const [checkDate, setCheckDate] = React.useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [schedule, setSchedule] = React.useState<VenueSchedule[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] =
    React.useState(false);

  const activeVenues = venues.filter((v) => v.isActive);

  // Notify parent of selection changes
  React.useEffect(() => {
    if (enabled) {
      const groupId = venueGroupId || generateGroupId();
      onSelectionChange({
        enabled: true,
        venueIds: selectedVenueIds,
        venueGroupId: groupId,
      });
    } else {
      onSelectionChange({
        enabled: false,
        venueIds: [],
        venueGroupId: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, selectedVenueIds]);

  function handleToggle(checked: boolean) {
    setEnabled(checked);
    if (!checked) {
      setSelectedVenueIds([]);
      setSchedule([]);
      setCheckDate(undefined);
    }
  }

  function handleVenueToggle(venueId: string, checked: boolean) {
    if (checked) {
      setSelectedVenueIds((prev) => [...prev, venueId]);
    } else {
      setSelectedVenueIds((prev) => prev.filter((id) => id !== venueId));
    }
    // Clear schedule when selection changes
    setSchedule([]);
  }

  async function handleCheckAvailability() {
    if (selectedVenueIds.length < 2) {
      toast.error("Select at least 2 venues to check coordinated availability");
      return;
    }

    if (!checkDate) {
      toast.error("Select a date to check availability");
      return;
    }

    setIsCheckingAvailability(true);
    try {
      const result = await getCoordinatedSchedule(selectedVenueIds, checkDate);
      if (result.success) {
        setSchedule(result.data as VenueSchedule[]);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to check coordinated availability");
    } finally {
      setIsCheckingAvailability(false);
    }
  }

  // Find slots where ALL selected venues are available
  const commonAvailableSlots = React.useMemo(() => {
    if (schedule.length === 0) return [];

    const slotKeys = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"] as const;
    return slotKeys.filter((slot) =>
      schedule.every((venue) => venue.slots[slot].available)
    );
  }, [schedule]);

  if (!enabled) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <NetworkIcon className="size-5 text-zinc-400" />
              <div>
                <p className="text-sm font-medium">Multi-Venue Event</p>
                <p className="text-xs text-zinc-500">
                  Enable to book multiple venues for this event
                </p>
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={handleToggle} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-indigo-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NetworkIcon className="size-5 text-indigo-600" />
            <div>
              <CardTitle className="text-base">Multi-Venue Event</CardTitle>
              <CardDescription>
                Select venues and check coordinated availability
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Venue Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Select Venues ({selectedVenueIds.length} selected)
          </Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {activeVenues.map((venue) => {
              const isSelected = selectedVenueIds.includes(venue.id);
              return (
                <div
                  key={venue.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    isSelected
                      ? "border-indigo-300 bg-indigo-50"
                      : "hover:border-zinc-300"
                  )}
                  onClick={() => handleVenueToggle(venue.id, !isSelected)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      handleVenueToggle(venue.id, !!checked)
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{venue.name}</p>
                    <p className="text-xs text-zinc-500">
                      Capacity: {venue.capacity}
                    </p>
                  </div>
                  {isSelected && (
                    <BuildingIcon className="size-4 text-indigo-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
          {selectedVenueIds.length > 0 && selectedVenueIds.length < 2 && (
            <p className="text-xs text-amber-600">
              Select at least 2 venues for a multi-venue event.
            </p>
          )}
        </div>

        {/* Coordinated Availability Check */}
        {selectedVenueIds.length >= 2 && (
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-medium">
              Check Coordinated Availability
            </Label>
            <div className="flex items-center gap-3">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !checkDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {checkDate ? format(checkDate, "dd MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkDate}
                    onSelect={(date) => {
                      setCheckDate(date);
                      setCalendarOpen(false);
                      setSchedule([]);
                    }}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                  />
                </PopoverContent>
              </Popover>
              <Button
                onClick={handleCheckAvailability}
                disabled={isCheckingAvailability || !checkDate}
                size="sm"
              >
                {isCheckingAvailability ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : null}
                Check Availability
              </Button>
            </div>

            {/* Schedule Results */}
            {schedule.length > 0 && (
              <div className="space-y-3">
                {/* Common availability summary */}
                {commonAvailableSlots.length > 0 ? (
                  <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                    <CheckCircle2Icon className="size-4 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        All venues available together
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {commonAvailableSlots.map((slot) => (
                          <Badge
                            key={slot}
                            className="bg-green-100 text-green-700 border-green-200 text-[10px]"
                          >
                            {SLOT_LABELS[slot]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <XCircleIcon className="size-4 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        No common slot available across all selected venues
                      </p>
                      <p className="text-xs text-red-600 mt-0.5">
                        Try a different date or remove conflicting venues.
                      </p>
                    </div>
                  </div>
                )}

                {/* Per-venue breakdown */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Per-Venue Breakdown
                  </p>
                  {schedule.map((venueSchedule) => (
                    <div
                      key={venueSchedule.venueId}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <BuildingIcon className="size-4 text-zinc-500" />
                        <p className="text-sm font-medium">
                          {venueSchedule.venueName}
                        </p>
                        <span className="text-xs text-zinc-400">
                          Cap: {venueSchedule.capacity}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {(
                          Object.entries(venueSchedule.slots) as [
                            string,
                            SlotAvailability,
                          ][]
                        ).map(([slot, availability]) => (
                          <div
                            key={slot}
                            className={cn(
                              "flex items-center gap-1.5 rounded px-2 py-1 text-xs",
                              availability.available
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-600"
                            )}
                            title={availability.reason || undefined}
                          >
                            {availability.available ? (
                              <CheckCircle2Icon className="size-3 shrink-0" />
                            ) : (
                              <XCircleIcon className="size-3 shrink-0" />
                            )}
                            <span className="truncate">
                              {SLOT_LABELS[slot] || slot}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Group ID Display */}
        {selectedVenueIds.length >= 2 && venueGroupId && (
          <div className="border-t pt-3">
            <p className="text-xs text-zinc-500">
              Venue Group ID:{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono">
                {venueGroupId}
              </code>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
