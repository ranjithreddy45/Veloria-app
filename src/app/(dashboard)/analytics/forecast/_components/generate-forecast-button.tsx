"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SparklesIcon } from "lucide-react";

import { generateForecast } from "@/actions/forecast.actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// GenerateForecastButton Component
// ============================================================

export function GenerateForecastButton() {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [months, setMonths] = React.useState("6");

  async function handleGenerate() {
    setIsPending(true);
    try {
      const result = await generateForecast(parseInt(months, 10));
      if (result.success) {
        toast.success(
          `Forecast generated for ${months} month${parseInt(months) > 1 ? "s" : ""}`
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
    <div className="flex items-center gap-2">
      <Select value={months} onValueChange={setMonths}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Months" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <SelectItem key={m} value={String(m)}>
              {m} month{m > 1 ? "s" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={handleGenerate} disabled={isPending}>
        {isPending ? (
          <Loader2Icon className="mr-2 size-4 animate-spin" />
        ) : (
          <SparklesIcon className="mr-2 size-4" />
        )}
        Generate Forecast
      </Button>
    </div>
  );
}
