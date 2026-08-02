"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

export interface DateRange {
  startDate: string | undefined;
  endDate: string | undefined;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

// ============================================================
// Preset Definitions
// ============================================================

type PresetKey = "7d" | "30d" | "3m" | "1y" | "all" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "1y", label: "Last year" },
  { key: "all", label: "All time" },
];

function getPresetRange(key: PresetKey): DateRange {
  const now = new Date();
  const end = now.toISOString().split("T")[0];

  switch (key) {
    case "7d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    }
    case "30d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    }
    case "3m": {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    }
    case "1y": {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      return { startDate: start.toISOString().split("T")[0], endDate: end };
    }
    case "all":
      return { startDate: undefined, endDate: undefined };
    case "custom":
      return { startDate: undefined, endDate: undefined };
  }
}

function detectActivePreset(range: DateRange): PresetKey | null {
  if (!range.startDate && !range.endDate) return "all";

  const now = new Date();
  const end = now.toISOString().split("T")[0];

  for (const preset of PRESETS) {
    if (preset.key === "all") continue;
    const presetRange = getPresetRange(preset.key);
    if (
      presetRange.startDate === range.startDate &&
      presetRange.endDate === end
    ) {
      return preset.key;
    }
  }
  return null;
}

// ============================================================
// Date Range Picker Component
// ============================================================

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const activePreset = detectActivePreset(value);

  const handlePreset = useCallback(
    (key: PresetKey) => {
      if (key === "custom") {
        setShowCustom(true);
        return;
      }
      setShowCustom(false);
      onChange(getPresetRange(key));
    },
    [onChange]
  );

  const handleCustomChange = useCallback(
    (field: "startDate" | "endDate", val: string) => {
      onChange({ ...value, [field]: val || undefined });
    },
    [onChange, value]
  );

  return (
    <Card className={cn("rounded-2xl border bg-card py-0 shadow-card", className)}>
      <CardContent className="px-4 py-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarIcon className="size-3.5" />
            <span className="text-meta font-medium uppercase tracking-wide">
              Period
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant={activePreset === preset.key && !showCustom ? "default" : "outline"}
                size="sm"
                className="h-7 rounded-lg text-detail"
                onClick={() => handlePreset(preset.key)}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              variant={showCustom ? "default" : "outline"}
              size="sm"
              className="h-7 rounded-lg text-detail"
              onClick={() => setShowCustom((prev) => !prev)}
            >
              Custom
            </Button>
          </div>

          {showCustom && (
            <div className="flex items-end gap-2 mt-1 sm:mt-0">
              <div className="space-y-1">
                <Label htmlFor="dr-start" className="text-meta uppercase tracking-wide text-muted-foreground">
                  From
                </Label>
                <Input
                  id="dr-start"
                  type="date"
                  className="numeric h-7 w-[140px] text-detail"
                  value={value.startDate ?? ""}
                  onChange={(e) => handleCustomChange("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dr-end" className="text-meta uppercase tracking-wide text-muted-foreground">
                  To
                </Label>
                <Input
                  id="dr-end"
                  type="date"
                  className="numeric h-7 w-[140px] text-detail"
                  value={value.endDate ?? ""}
                  onChange={(e) => handleCustomChange("endDate", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
