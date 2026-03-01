"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  MoreHorizontalIcon,
  CheckCircleIcon,
  BanknoteIcon,
} from "lucide-react";

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PAYROLL_STATUS_COLORS } from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";
import { approvePayroll, markPayrollPaid } from "@/actions/staff.actions";

// ============================================================
// Payroll Entry Type
// ============================================================

interface PayrollEntryRow {
  id: string;
  month: string;
  basePay: number;
  overtimePay: number;
  deductions: number;
  netPay: number;
  status: string;
  paidAt: string | null;
  staff: {
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  };
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ entry }: { entry: PayrollEntryRow }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleApprove = async () => {
    setLoading(true);
    const result = await approvePayroll(entry.id);
    if (result.success) {
      toast.success("Payroll approved");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleMarkPaid = async () => {
    setLoading(true);
    const result = await markPayrollPaid(entry.id);
    if (result.success) {
      toast.success("Payroll marked as paid");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" disabled={loading}>
          <MoreHorizontalIcon className="size-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {entry.status === "DRAFT" && (
          <DropdownMenuItem onClick={handleApprove}>
            <CheckCircleIcon className="mr-2 size-4" />
            Approve
          </DropdownMenuItem>
        )}
        {entry.status === "APPROVED" && (
          <DropdownMenuItem onClick={handleMarkPaid}>
            <BanknoteIcon className="mr-2 size-4" />
            Mark as Paid
          </DropdownMenuItem>
        )}
        {entry.status === "PAID" && (
          <DropdownMenuItem disabled>
            <CheckCircleIcon className="mr-2 size-4 text-green-600" />
            Already Paid
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================
// Column Definitions
// ============================================================

const columns: ColumnDef<PayrollEntryRow>[] = [
  {
    accessorKey: "staffName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Staff Name" />
    ),
    accessorFn: (row) => row.staff.user.name || row.staff.user.email || "Unknown",
    cell: ({ row }) => {
      const entry = row.original;
      return (
        <div>
          <span className="font-medium">
            {entry.staff.user.name || "Unnamed"}
          </span>
          {entry.staff.user.email && (
            <p className="text-xs text-muted-foreground">
              {entry.staff.user.email}
            </p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "basePay",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Base Pay" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">{formatINR(row.getValue("basePay"))}</span>
    ),
  },
  {
    accessorKey: "overtimePay",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Overtime" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">{formatINR(row.getValue("overtimePay"))}</span>
    ),
  },
  {
    accessorKey: "deductions",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Deductions" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-red-600">
        {formatINR(row.getValue("deductions"))}
      </span>
    ),
  },
  {
    accessorKey: "netPay",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Net Pay" />
    ),
    cell: ({ row }) => (
      <span className="text-sm font-semibold">
        {formatINR(row.getValue("netPay"))}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.getValue("status")}
        colorMap={PAYROLL_STATUS_COLORS}
      />
    ),
  },
  {
    accessorKey: "paidAt",
    header: "Paid At",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.getValue("paidAt") ? formatDate(row.getValue("paidAt")) : "--"}
      </span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell entry={row.original} />,
  },
];

// ============================================================
// Payroll Table Component
// ============================================================

interface PayrollTableProps {
  data: PayrollEntryRow[];
}

export function PayrollTable({ data }: PayrollTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="staffName"
      searchPlaceholder="Search by staff name..."
    />
  );
}
