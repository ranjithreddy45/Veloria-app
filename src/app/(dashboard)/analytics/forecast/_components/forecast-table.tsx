"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils";

// ============================================================
// ForecastEntry Type
// ============================================================

interface ForecastEntry {
  id: string;
  month: string;
  year: number;
  predictedRevenue: number;
  predictedBookings: number;
  confidence: number;
  generatedAt: string;
}

// ============================================================
// Columns Definition
// ============================================================

const columns: ColumnDef<ForecastEntry>[] = [
  {
    accessorKey: "month",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Month" />
    ),
    cell: ({ row }) => {
      const month = row.getValue("month") as string;
      // Parse YYYY-MM to readable format
      const [year, mon] = month.split("-");
      const date = new Date(parseInt(year), parseInt(mon) - 1);
      return (
        <span className="font-medium">
          {date.toLocaleString("en-IN", { month: "long", year: "numeric" })}
        </span>
      );
    },
  },
  {
    accessorKey: "predictedRevenue",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Predicted Revenue" />
    ),
    cell: ({ row }) => (
      <span className="numeric font-medium text-emerald-700 dark:text-emerald-400">
        {formatINR(row.getValue("predictedRevenue"))}
      </span>
    ),
  },
  {
    accessorKey: "predictedBookings",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Predicted Bookings" />
    ),
    cell: ({ row }) => (
      <span className="numeric text-[13px]">{row.getValue("predictedBookings")}</span>
    ),
  },
  {
    accessorKey: "confidence",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Confidence" />
    ),
    cell: ({ row }) => {
      const confidence = row.getValue("confidence") as number;
      const percent = Math.round(confidence * 100);
      return (
        <Badge
          variant="secondary"
          className={
            percent >= 80
              ? "numeric bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : percent >= 50
                ? "numeric bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                : "numeric bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
          }
        >
          {percent}%
        </Badge>
      );
    },
  },
  {
    accessorKey: "generatedAt",
    header: "Generated At",
    cell: ({ row }) => {
      const date = row.getValue("generatedAt") as string;
      return (
        <span className="numeric text-[13px] text-muted-foreground">
          {new Date(date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      );
    },
  },
];

// ============================================================
// ForecastTable Component
// ============================================================

interface ForecastTableProps {
  data: ForecastEntry[];
}

export function ForecastTable({ data }: ForecastTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="month"
      searchPlaceholder="Search by month..."
    />
  );
}
