"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  YIELD_RULE_TYPE_COLORS,
  YIELD_RULE_TYPE_LABELS,
  describeYieldConditions,
} from "@/lib/pricing/yield-rule-types";
import { deletePricingRule } from "@/actions/pricing.actions";

// ============================================================
// Types
// ============================================================

interface YieldRuleRow {
  id: string;
  name: string;
  ruleType: string;
  multiplier: number;
  conditions: unknown;
  isActive: boolean;
  priority: number;
  venue: { id: string; name: string };
}

interface YieldRulesTableProps {
  data: YieldRuleRow[];
}

// ============================================================
// YieldRulesTable
// ============================================================

export function YieldRulesTable({ data }: YieldRulesTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleDelete(ruleId: string) {
    setDeletingId(ruleId);
    try {
      const result = await deletePricingRule(ruleId);
      if (result.success) {
        toast.success("Yield rule deleted");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete yield rule");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: ColumnDef<YieldRuleRow, unknown>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Rule Name" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/pricing/yield/${row.original.id}/edit`}
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
          colorMap={YIELD_RULE_TYPE_COLORS}
          label={
            YIELD_RULE_TYPE_LABELS[row.original.ruleType] ??
            row.original.ruleType
          }
        />
      ),
    },
    {
      accessorKey: "venue",
      header: "Venue",
      cell: ({ row }) => (
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          {row.original.venue?.name ?? "--"}
        </span>
      ),
    },
    {
      id: "band",
      header: "Band",
      cell: ({ row }) => (
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {describeYieldConditions(
            row.original.ruleType,
            row.original.conditions
          )}
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
                <Link href={`/pricing/yield/${rule.id}/edit`}>
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
      searchPlaceholder="Search yield rules..."
    />
  );
}
