"use client";

import * as React from "react";

import type { HotDateRow } from "@/actions/peak-dates.actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TIER_LABEL: Record<string, string> = {
  MUHURTHAM: "Muhurtham",
  FESTIVAL: "Festival / peak",
  WEEKEND: "Weekend",
  REGULAR: "Standard",
};
const TIER_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  MUHURTHAM: "default",
  FESTIVAL: "secondary",
  WEEKEND: "outline",
  REGULAR: "outline",
};

function fmtDate(key: string): string {
  return new Date(key + "T00:00:00.000Z").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Heat band by recommended premium %.
function heatClass(pct: number): string {
  if (pct >= 25) return "text-red-600 dark:text-red-400";
  if (pct >= 15) return "text-orange-600 dark:text-orange-400";
  if (pct >= 8) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function HotDatesTable({ rows }: { rows: HotDateRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No premium dates in the next 120 days. Add Muhurtham / festival dates on the
        Date Demand page.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Day</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Why</TableHead>
            <TableHead className="text-right">Premium</TableHead>
            <TableHead className="text-right">Booked</TableHead>
            <TableHead>Scope</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.date}-${r.tier}`}>
              <TableCell className="font-medium whitespace-nowrap">
                {fmtDate(r.date)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {r.weekday}
              </TableCell>
              <TableCell>
                <Badge variant={TIER_VARIANT[r.tier] ?? "outline"}>
                  {TIER_LABEL[r.tier] ?? r.tier}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {r.label}
                {r.scarcityBumpPct > 0 && (
                  <span className="ml-1 text-xs text-orange-600 dark:text-orange-400">
                    (+{r.scarcityBumpPct}% scarcity)
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <span className={`font-semibold tabular-nums ${heatClass(r.premiumPct)}`}>
                  +{r.premiumPct}%
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.bookingsOnDate > 0 ? (
                  <span className="font-medium">{r.bookingsOnDate}</span>
                ) : (
                  <span className="text-muted-foreground">0 — open</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {r.venueScopedLabel ?? "All venues"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
