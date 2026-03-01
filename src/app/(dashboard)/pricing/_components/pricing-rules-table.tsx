"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PRICING_RULE_TYPE_COLORS,
  PRICING_RULE_TYPE_LABELS,
  DAY_OF_WEEK_LABELS,
} from "@/lib/constants";
import { deletePricingRule } from "@/actions/pricing.actions";
import { formatINR } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface PricingRuleRow {
  id: string;
  name: string;
  ruleType: string;
  multiplier: number;
  conditions: unknown;
  startDate: string | null;
  endDate: string | null;
  dayOfWeek: number | null;
  minDaysAhead: number | null;
  isActive: boolean;
  priority: number;
  venue: { id: string; name: string };
  createdAt: string;
}

interface PricingRulesTableProps {
  data: PricingRuleRow[];
}

// ============================================================
// PricingRulesTable Component
// ============================================================

export function PricingRulesTable({ data }: PricingRulesTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleDelete(ruleId: string) {
    setDeletingId(ruleId);
    try {
      const result = await deletePricingRule(ruleId);
      if (result.success) {
        toast.success("Pricing rule deleted successfully");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete pricing rule");
    } finally {
      setDeletingId(null);
    }
  }

  function getRuleDetail(row: PricingRuleRow): string {
    switch (row.ruleType) {
      case "SEASONAL":
        if (row.startDate && row.endDate) {
          return `${format(new Date(row.startDate), "dd MMM")} - ${format(new Date(row.endDate), "dd MMM")}`;
        }
        return "All dates";
      case "DAY_OF_WEEK":
        return row.dayOfWeek !== null && row.dayOfWeek !== undefined
          ? DAY_OF_WEEK_LABELS[row.dayOfWeek] || `Day ${row.dayOfWeek}`
          : "--";
      case "EARLY_BIRD":
        return row.minDaysAhead !== null
          ? `${row.minDaysAhead}+ days ahead`
          : "30+ days ahead";
      case "LAST_MINUTE":
        return row.minDaysAhead !== null
          ? `Within ${row.minDaysAhead} days`
          : "Within 7 days";
      case "PEAK_HOUR":
        return "Time-based";
      default:
        return "--";
    }
  }

  const columns: ColumnDef<PricingRuleRow, unknown>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Rule Name" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/pricing/${row.original.id}/edit`}
          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "ruleType",
      header: "Type",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.ruleType}
          colorMap={PRICING_RULE_TYPE_COLORS}
          label={PRICING_RULE_TYPE_LABELS[row.original.ruleType] || row.original.ruleType}
        />
      ),
    },
    {
      accessorKey: "venue",
      header: "Venue",
      cell: ({ row }) => (
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          {row.original.venue.name}
        </span>
      ),
    },
    {
      accessorKey: "multiplier",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Multiplier" />
      ),
      cell: ({ row }) => {
        const multiplier = row.original.multiplier;
        const isDiscount = multiplier < 1;
        const percentage = Math.round((multiplier - 1) * 100);
        return (
          <div className="text-sm">
            <span className="font-medium">{multiplier}x</span>
            <span
              className={`ml-1 text-xs ${
                isDiscount
                  ? "text-green-600 dark:text-green-400"
                  : percentage > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              ({isDiscount ? "" : "+"}
              {percentage}%)
            </span>
          </div>
        );
      },
    },
    {
      id: "detail",
      header: "Condition",
      cell: ({ row }) => (
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {getRuleDetail(row.original)}
        </span>
      ),
    },
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Priority" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {row.original.priority}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.original.isActive
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const rule = row.original;
        const isDeleting = deletingId === rule.id;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" disabled={isDeleting}>
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href={`/pricing/${rule.id}/edit`}>
                  <PencilIcon className="mr-2 size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => handleDelete(rule.id)}
                disabled={isDeleting}
              >
                <Trash2Icon className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search pricing rules..."
    />
  );
}
