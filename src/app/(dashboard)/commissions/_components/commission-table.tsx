"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  MoreHorizontalIcon,
  CheckCircleIcon,
  BanknoteIcon,
  ReceiptIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import {
  FacetFilterRail,
  type FacetDef,
} from "@/components/shared/facet-filter-rail";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR } from "@/lib/utils";
import {
  approveCommission,
  markCommissionPaid,
} from "@/actions/commission.actions";
import { CommissionStatusPill } from "./commission-stats";

// ============================================================
// Types
// ============================================================

type CommissionEntryRow = {
  id: string;
  invoiceAmount: number;
  commissionAmount: number;
  status: string;
  paidAt?: string | null;
  createdAt: string;
  ruleId: string;
  userId: string;
  bookingId: string;
  rule: {
    id: string;
    name: string;
    percentage: number;
  };
};

// ============================================================
// Columns
// ============================================================

function ActionsCell({ row }: { row: { original: CommissionEntryRow } }) {
  const [isPending, startTransition] = React.useTransition();
  const entry = row.original;

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveCommission(entry.id);
      if (result.success) {
        toast.success("Commission approved");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleMarkPaid = () => {
    startTransition(async () => {
      const result = await markCommissionPaid(entry.id);
      if (result.success) {
        toast.success("Commission marked as paid");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" disabled={isPending}>
          <MoreHorizontalIcon className="size-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {entry.status === "PENDING" && (
          <DropdownMenuItem onClick={handleApprove}>
            <CheckCircleIcon className="mr-2 size-4" />
            Approve
          </DropdownMenuItem>
        )}
        {entry.status === "APPROVED" && (
          <DropdownMenuItem onClick={handleMarkPaid}>
            <BanknoteIcon className="mr-2 size-4" />
            Mark Paid
          </DropdownMenuItem>
        )}
        {entry.status === "PAID" && (
          <DropdownMenuItem disabled>
            <CheckCircleIcon className="mr-2 size-4" />
            Already Paid
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columns: ColumnDef<CommissionEntryRow, unknown>[] = [
  {
    accessorKey: "rule.name",
    id: "ruleName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Rule" />
    ),
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.rule.name}</div>
        <div className="text-xs text-muted-foreground">
          {row.original.rule.percentage}%
        </div>
      </div>
    ),
  },
  {
    accessorKey: "userId",
    header: "User ID",
    cell: ({ row }) => (
      <span className="text-sm font-mono text-muted-foreground">
        {row.original.userId.slice(0, 8)}...
      </span>
    ),
  },
  {
    accessorKey: "bookingId",
    header: "Booking ID",
    cell: ({ row }) => (
      <span className="text-sm font-mono text-muted-foreground">
        {row.original.bookingId.slice(0, 8)}...
      </span>
    ),
  },
  {
    accessorKey: "invoiceAmount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Invoice Amount" />
    ),
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {formatINR(row.original.invoiceAmount)}
      </span>
    ),
  },
  {
    accessorKey: "commissionAmount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Commission" />
    ),
    cell: ({ row }) => (
      <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
        {formatINR(row.original.commissionAmount)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <CommissionStatusPill status={row.original.status} />,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) =>
      format(new Date(row.original.createdAt), "dd MMM yyyy"),
  },
  {
    accessorKey: "paidAt",
    header: "Paid At",
    cell: ({ row }) =>
      row.original.paidAt
        ? format(new Date(row.original.paidAt), "dd MMM yyyy")
        : "--",
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell row={row} />,
  },
];

// ============================================================
// CommissionTable Component
// ============================================================

interface CommissionTableProps {
  data: CommissionEntryRow[];
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PAID: "Paid",
};

const facets: FacetDef<CommissionEntryRow>[] = [
  {
    key: "status",
    label: "Status",
    get: (row) => row.status,
    format: (value) => STATUS_LABEL[value] ?? value,
  },
  {
    key: "rule",
    label: "Rule",
    get: (row) => row.rule.name,
  },
];

export function CommissionTable({ data }: CommissionTableProps) {
  const [filtered, setFiltered] = React.useState<CommissionEntryRow[]>(data);

  React.useEffect(() => {
    setFiltered(data);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-card shadow-card">
        <EmptyState
          icon={<ReceiptIcon className="size-5" />}
          title="No commission entries yet"
          description="Commission entries appear here once bookings are matched against your active rules."
        />
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <FacetFilterRail
        items={data}
        facets={facets}
        onChange={setFiltered}
        className="hidden lg:block"
      />
      <div className="min-w-0 flex-1">
        <DataTable
          columns={columns}
          data={filtered}
          searchKey="ruleName"
          searchPlaceholder="Search by rule name..."
        />
      </div>
    </div>
  );
}
