"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  MoreHorizontalIcon,
  EyeIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CONTRACT_STATUS_COLORS } from "@/lib/constants";
import { sendContract, deleteContract } from "@/actions/contract.actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

type ContractRow = {
  id: string;
  title: string;
  status: string;
  sentAt: Date | string | null;
  signedAt: Date | string | null;
  expiresAt: Date | string | null;
  signerName: string | null;
  signerEmail: string | null;
  createdAt: Date | string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    company?: string | null;
  };
  booking?: {
    id: string;
    bookingNumber: string;
    eventName: string;
  } | null;
  template?: {
    id: string;
    name: string;
  } | null;
};

// ============================================================
// Columns
// ============================================================

function useColumns(): ColumnDef<ContractRow, unknown>[] {
  const router = useRouter();

  const handleSend = async (id: string) => {
    const result = await sendContract(id);
    if (result.success) {
      toast.success("Contract sent successfully");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to send contract");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft contract?"))
      return;
    const result = await deleteContract(id);
    if (result.success) {
      toast.success("Contract deleted");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete contract");
    }
  };

  return [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/contracts/${row.original.id}`}
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "contact",
      header: "Contact",
      cell: ({ row }) => {
        const c = row.original.contact;
        return (
          <div>
            <div className="font-medium">
              {c.firstName} {c.lastName}
            </div>
            {c.company && (
              <div className="text-xs text-muted-foreground">{c.company}</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "signerName",
      header: "Signer",
      cell: ({ row }) => {
        const name = row.original.signerName;
        const email = row.original.signerEmail;
        if (!name && !email)
          return <span className="text-muted-foreground">--</span>;
        return (
          <div>
            {name && <div className="text-sm">{name}</div>}
            {email && (
              <div className="text-xs text-muted-foreground">{email}</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "booking",
      header: "Booking",
      cell: ({ row }) => {
        const b = row.original.booking;
        if (!b) return <span className="text-muted-foreground">--</span>;
        return (
          <div>
            <div className="text-sm">{b.bookingNumber}</div>
            <div className="text-xs text-muted-foreground">{b.eventName}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) =>
        format(new Date(row.original.createdAt), "dd MMM yyyy"),
    },
    {
      accessorKey: "expiresAt",
      header: "Expires",
      cell: ({ row }) => {
        const d = row.original.expiresAt;
        if (!d) return <span className="text-muted-foreground">--</span>;
        const isExpired = new Date(d) < new Date();
        return (
          <span className={isExpired ? "text-red-600 font-medium" : ""}>
            {format(new Date(d), "dd MMM yyyy")}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          colorMap={CONTRACT_STATUS_COLORS}
        />
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const contract = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/contracts/${contract.id}`}>
                  <EyeIcon className="mr-2 size-4" />
                  View
                </Link>
              </DropdownMenuItem>
              {contract.status === "DRAFT" && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/contracts/${contract.id}/edit`}>
                      <PencilIcon className="mr-2 size-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSend(contract.id)}
                  >
                    <SendIcon className="mr-2 size-4" />
                    Send Contract
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(contract.id)}
                    className="text-red-600"
                  >
                    <Trash2Icon className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

// ============================================================
// ContractsTable Component
// ============================================================

interface ContractsTableProps {
  data: ContractRow[];
}

export function ContractsTable({ data }: ContractsTableProps) {
  const columns = useColumns();

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="title"
      searchPlaceholder="Search contracts..."
    />
  );
}
