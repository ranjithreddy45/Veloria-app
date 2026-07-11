"use client";

import type { ChangeEvent } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Year selector — updates the ?year= search param and re-fetches the report
// on the server. Preserves any other existing search params.
export function YearSelect({ years, value }: { years: number[]; value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
      Year
      <select
        value={value}
        onChange={onChange}
        className="h-8 rounded-lg border border-border/70 bg-background px-2 text-[12.5px] font-medium text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
