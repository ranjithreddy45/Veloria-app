"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// BudgetYearFilter Component
// ============================================================

export function BudgetYearFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentYear = searchParams.get("year") || String(new Date().getFullYear());

  const years = Array.from({ length: 10 }, (_, i) => {
    const year = new Date().getFullYear() - 3 + i;
    return String(year);
  });

  function handleYearChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("year");
    } else {
      params.set("year", value);
    }
    router.push(`/analytics/budget?${params.toString()}`);
  }

  return (
    <Select value={currentYear} onValueChange={handleYearChange}>
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Years</SelectItem>
        {years.map((year) => (
          <SelectItem key={year} value={year}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
