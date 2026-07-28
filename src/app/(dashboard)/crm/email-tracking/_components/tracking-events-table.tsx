"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { EyeIcon, MousePointerClickIcon, ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table";
import type { TrackingEventRow } from "@/schemas/email-tracking.schema";

// ============================================================
// Tracking Events Table Component
// ============================================================

interface TrackingEventsTableProps {
  data: TrackingEventRow[];
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

const columns: ColumnDef<TrackingEventRow>[] = [
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue("type") as string;
      if (type === "EMAIL_OPEN") {
        return (
          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
            <EyeIcon className="mr-1 size-3" />
            Open
          </Badge>
        );
      }
      return (
        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
          <MousePointerClickIcon className="mr-1 size-3" />
          Click
        </Badge>
      );
    },
    filterFn: (row, _id, filterValue) => {
      if (!filterValue || filterValue === "ALL") return true;
      return row.getValue("type") === filterValue;
    },
  },
  {
    accessorKey: "recipientEmail",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Recipient" />
    ),
    cell: ({ row }) => (
      <span className="text-sm font-medium">{row.getValue("recipientEmail")}</span>
    ),
  },
  {
    accessorKey: "subject",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Subject" />
    ),
    cell: ({ row }) => {
      const subject = row.getValue("subject") as string | null;
      return (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {subject || "--"}
        </span>
      );
    },
  },
  {
    accessorKey: "linkUrl",
    header: "Link URL",
    cell: ({ row }) => {
      const url = row.getValue("linkUrl") as string | null;
      if (!url) return <span className="text-muted-foreground">--</span>;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary flex max-w-[200px] items-center gap-1 truncate text-sm hover:underline"
        >
          {url.replace(/^https?:\/\//, "").slice(0, 30)}
          <ExternalLinkIcon className="size-3 shrink-0" />
        </a>
      );
    },
  },
  {
    accessorKey: "ipAddress",
    header: "IP",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground font-mono">
        {(row.getValue("ipAddress") as string) || "--"}
      </span>
    ),
  },
  {
    accessorKey: "occurredAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(row.getValue("occurredAt") as string)}
      </span>
    ),
  },
];

export function TrackingEventsTable({ data }: TrackingEventsTableProps) {
  const [filterType, setFilterType] = React.useState<string>("ALL");

  const filteredData = React.useMemo(() => {
    if (filterType === "ALL") return data;
    return data.filter((event) => event.type === filterType);
  }, [data, filterType]);

  const filterButtons = (
    <div className="flex items-center gap-1">
      {[
        { label: "All", value: "ALL" },
        { label: "Opens", value: "EMAIL_OPEN" },
        { label: "Clicks", value: "LINK_CLICK" },
      ].map((btn) => (
        <Button
          key={btn.value}
          variant={filterType === btn.value ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType(btn.value)}
        >
          {btn.label}
        </Button>
      ))}
    </div>
  );

  return (
    <DataTable
      columns={columns}
      data={filteredData}
      searchKey="recipientEmail"
      searchPlaceholder="Search by recipient..."
      toolbarExtra={filterButtons}
    />
  );
}
