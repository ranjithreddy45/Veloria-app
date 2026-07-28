"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ChevronDownIcon, ChevronRightIcon, AlertTriangleIcon } from "lucide-react";

import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { WebformField } from "@/schemas/webform.schema";

// ============================================================
// Submission Type
// ============================================================

interface Submission {
  id: string;
  data: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  isSpam: boolean;
  createdAt: string;
  contactId: string | null;
  leadId: string | null;
}

// ============================================================
// Expandable Row
// ============================================================

function ExpandableRow({ submission }: { submission: Submission }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => setExpanded(!expanded)}
        className="size-6"
      >
        {expanded ? (
          <ChevronDownIcon className="size-3.5" />
        ) : (
          <ChevronRightIcon className="size-3.5" />
        )}
      </Button>
      {expanded && (
        <div className="mt-2 rounded-lg border bg-muted p-3">
          <div className="space-y-1.5">
            {Object.entries(submission.data).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs">
                <span className="font-medium text-muted-foreground min-w-[100px]">
                  {key}:
                </span>
                <span className="text-foreground">
                  {String(value ?? "--")}
                </span>
              </div>
            ))}
            {submission.ipAddress && (
              <div className="flex gap-2 text-xs border-t pt-1.5 mt-1.5">
                <span className="font-medium text-muted-foreground min-w-[100px]">
                  IP:
                </span>
                <span className="text-muted-foreground">{submission.ipAddress}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Submissions Table Component
// ============================================================

interface SubmissionsTableProps {
  data: Submission[];
  fields: WebformField[];
}

export function SubmissionsTable({ data, fields }: SubmissionsTableProps) {
  const [filter, setFilter] = React.useState<"all" | "spam" | "clean">("all");

  // Extract the first email-type field name for the email column
  const emailFieldName = fields.find((f) => f.type === "EMAIL")?.name || "email";

  const filteredData = React.useMemo(() => {
    if (filter === "spam") return data.filter((s) => s.isSpam);
    if (filter === "clean") return data.filter((s) => !s.isSpam);
    return data;
  }, [data, filter]);

  const columns: ColumnDef<Submission>[] = React.useMemo(
    () => [
      {
        id: "expand",
        enableHiding: false,
        cell: ({ row }) => <ExpandableRow submission={row.original} />,
      },
      {
        id: "date",
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {formatDate(row.getValue("createdAt"))}
          </span>
        ),
      },
      {
        id: "email",
        header: "Email",
        cell: ({ row }) => {
          const email =
            (row.original.data[emailFieldName] as string) ||
            (row.original.data.email as string) ||
            (row.original.data.Email as string) ||
            "--";
          return <span className="text-sm">{email}</span>;
        },
      },
      {
        id: "keyFields",
        header: "Key Data",
        cell: ({ row }) => {
          const d = row.original.data;
          // Show first 2 non-email fields
          const entries = Object.entries(d)
            .filter(
              ([key]) =>
                key.toLowerCase() !== "email" && key !== emailFieldName
            )
            .slice(0, 2);
          if (entries.length === 0) return "--";
          return (
            <div className="space-y-0.5">
              {entries.map(([key, value]) => (
                <div key={key} className="text-xs text-muted-foreground">
                  <span className="font-medium">{key}:</span>{" "}
                  {String(value ?? "").substring(0, 40)}
                  {String(value ?? "").length > 40 ? "..." : ""}
                </div>
              ))}
            </div>
          );
        },
      },
      {
        id: "spam",
        header: "Spam",
        cell: ({ row }) =>
          row.original.isSpam ? (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangleIcon className="mr-1 size-3" />
              Spam
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Clean
            </Badge>
          ),
      },
      {
        id: "contact",
        header: "Contact",
        cell: ({ row }) =>
          row.original.contactId ? (
            <a
              href={`/contacts/${row.original.contactId}`}
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              View
            </a>
          ) : (
            <span className="text-muted-foreground text-xs">--</span>
          ),
      },
      {
        id: "lead",
        header: "Lead",
        cell: ({ row }) =>
          row.original.leadId ? (
            <a
              href={`/leads/${row.original.leadId}`}
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              View
            </a>
          ) : (
            <span className="text-muted-foreground text-xs">--</span>
          ),
      },
    ],
    [emailFieldName]
  );

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All ({data.length})
        </Button>
        <Button
          variant={filter === "clean" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("clean")}
        >
          Clean ({data.filter((s) => !s.isSpam).length})
        </Button>
        <Button
          variant={filter === "spam" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("spam")}
        >
          Spam ({data.filter((s) => s.isSpam).length})
        </Button>
      </div>

      <DataTable columns={columns} data={filteredData} />
    </div>
  );
}
