"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generatePayroll } from "@/actions/staff.actions";

// ============================================================
// Types
// ============================================================

interface PayrollToolbarProps {
  month: string; // YYYY-MM
  entryCount: number;
}

// ============================================================
// PayrollToolbar Component
// ============================================================

export function PayrollToolbar({ month, entryCount }: PayrollToolbarProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  // Parse month
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  const monthLabel = new Date(year, monthNum - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const navigateMonth = (direction: number) => {
    const d = new Date(year, monthNum - 1 + direction, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    router.push(`/staff/payroll?month=${newMonth}`);
  };

  const handleGenerate = async () => {
    setLoading(true);
    const result = await generatePayroll(month);
    if (result.success) {
      toast.success(`Payroll generated for ${monthLabel}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Month Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => navigateMonth(-1)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="min-w-[160px] text-center text-sm font-medium">
          {monthLabel}
        </span>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => navigateMonth(1)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>

        <Badge variant="secondary" className="ml-2 text-xs">
          {entryCount} {entryCount === 1 ? "entry" : "entries"}
        </Badge>
      </div>

      {/* Generate Payroll */}
      <Button onClick={handleGenerate} disabled={loading}>
        <SparklesIcon className="mr-2 size-4" />
        {loading ? "Generating..." : "Generate Payroll"}
      </Button>
    </div>
  );
}
