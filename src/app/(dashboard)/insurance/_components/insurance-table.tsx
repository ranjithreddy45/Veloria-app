"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteInsurancePolicy, markAsClaimed } from "@/actions/insurance.actions";
import { formatINR, formatDate } from "@/lib/utils";
import {
  INSURANCE_TYPE_LABELS,
  INSURANCE_STATUS_COLORS,
} from "@/lib/constants";

// ============================================================
// Insurance Policy Type
// ============================================================

interface InsurancePolicy {
  id: string;
  provider: string;
  policyNumber: string;
  type: string;
  coverageAmount: number;
  premium: number;
  startDate: string;
  endDate: string;
  status: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  documents: any;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
  } | null;
  venue: {
    id: string;
    name: string;
  } | null;
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ policy }: { policy: InsurancePolicy }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteInsurancePolicy(policy.id);
    if (result.success) {
      toast.success("Insurance policy deleted successfully");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleMarkClaimed = async () => {
    const result = await markAsClaimed(policy.id);
    if (result.success) {
      toast.success("Policy marked as claimed");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs">
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/insurance/${policy.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/insurance/${policy.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </DropdownMenuItem>
          {policy.status === "ACTIVE" && (
            <DropdownMenuItem onClick={handleMarkClaimed}>
              <ShieldCheckIcon className="mr-2 size-4" />
              Mark as Claimed
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-destructive">
              <TrashIcon className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Insurance Policy</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete policy{" "}
            <span className="font-medium">{policy.policyNumber}</span>? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================
// Columns Definition
// ============================================================

const columns: ColumnDef<InsurancePolicy>[] = [
  {
    accessorKey: "policyNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Policy #" />
    ),
    cell: ({ row }) => {
      const policy = row.original;
      return (
        <Link
          href={`/insurance/${policy.id}`}
          className="font-medium hover:underline"
        >
          {policy.policyNumber}
        </Link>
      );
    },
  },
  {
    accessorKey: "provider",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Provider" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">{row.getValue("provider")}</span>
    ),
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs">
        {INSURANCE_TYPE_LABELS[row.getValue("type") as string] ??
          row.getValue("type")}
      </Badge>
    ),
    filterFn: (row, id, value) => value === row.getValue(id),
  },
  {
    accessorKey: "coverageAmount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Coverage" />
    ),
    cell: ({ row }) => (
      <span className="text-sm font-medium">
        {formatINR(row.getValue("coverageAmount"))}
      </span>
    ),
  },
  {
    accessorKey: "premium",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Premium" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatINR(row.getValue("premium"))}
      </span>
    ),
  },
  {
    accessorKey: "startDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Start Date" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">{formatDate(row.getValue("startDate"))}</span>
    ),
  },
  {
    accessorKey: "endDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="End Date" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">{formatDate(row.getValue("endDate"))}</span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const colorClasses =
        INSURANCE_STATUS_COLORS[status] ?? "bg-muted text-foreground/80";
      return (
        <Badge variant="outline" className={`text-xs ${colorClasses}`}>
          {status}
        </Badge>
      );
    },
    filterFn: (row, id, value) => value === row.getValue(id),
  },
  {
    id: "linked",
    header: "Linked To",
    cell: ({ row }) => {
      const policy = row.original;
      if (policy.booking) {
        return (
          <Link
            href={`/bookings/${policy.booking.id}`}
            className="text-xs text-blue-600 hover:underline"
          >
            {policy.booking.bookingNumber}
          </Link>
        );
      }
      if (policy.venue) {
        return (
          <span className="text-muted-foreground text-xs">
            {policy.venue.name}
          </span>
        );
      }
      return <span className="text-muted-foreground text-xs">--</span>;
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell policy={row.original} />,
  },
];

// ============================================================
// InsuranceTable Component
// ============================================================

interface InsuranceTableProps {
  data: InsurancePolicy[];
}

export function InsuranceTable({ data }: InsuranceTableProps) {
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");

  const filteredData = React.useMemo(() => {
    let result = data;
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (typeFilter !== "all") {
      result = result.filter((p) => p.type === typeFilter);
    }
    return result;
  }, [data, statusFilter, typeFilter]);

  const filterToolbar = (
    <div className="flex items-center gap-2">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="ACTIVE">Active</SelectItem>
          <SelectItem value="EXPIRED">Expired</SelectItem>
          <SelectItem value="CLAIMED">Claimed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="EVENT_LIABILITY">Event Liability</SelectItem>
          <SelectItem value="PROPERTY">Property</SelectItem>
          <SelectItem value="CANCELLATION">Cancellation</SelectItem>
          <SelectItem value="WEATHER">Weather</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <DataTable
      columns={columns}
      data={filteredData}
      searchKey="policyNumber"
      searchPlaceholder="Search by policy number..."
      toolbarExtra={filterToolbar}
    />
  );
}
