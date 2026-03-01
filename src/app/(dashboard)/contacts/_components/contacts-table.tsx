"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  DownloadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumnHeader, getSelectionColumn } from "@/components/shared/data-table";
import { SavedViewSelector } from "@/components/shared/saved-view-selector";
import { BulkActionBar, TrashIcon as BulkTrashIcon, TagIcon } from "@/components/shared/bulk-action-bar";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { MessageCircle } from "lucide-react";
import { deleteContact } from "@/actions/contact.actions";
import { bulkDeleteContacts, bulkUpdateContacts } from "@/actions/bulk.actions";
import { exportContacts } from "@/actions/export.actions";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { BulkWhatsAppDialog } from "@/components/shared/bulk-whatsapp-dialog";

// ============================================================
// Contact Type (matching Prisma Contact model)
// ============================================================

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  company: string | null;
  designation: string | null;
  type: "INDIVIDUAL" | "CORPORATE";
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  notes: string | null;
  tags: string[];
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================
// Contact Type Colors
// ============================================================

const CONTACT_TYPE_COLORS: Record<string, string> = {
  INDIVIDUAL: "bg-blue-100 text-blue-800 border-blue-200",
  CORPORATE: "bg-purple-100 text-purple-800 border-purple-200",
};

// ============================================================
// Columns Definition
// ============================================================

function ActionsCell({ contact }: { contact: Contact }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteContact(contact.id);
    if (result.success) {
      toast.success("Contact deleted successfully");
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
            <Link href={`/contacts/${contact.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/contacts/${contact.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </DropdownMenuItem>
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
          <AlertDialogTitle>Delete Contact</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">
              {contact.firstName} {contact.lastName}
            </span>
            ? This action cannot be undone.
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

const columns: ColumnDef<Contact>[] = [
  getSelectionColumn<Contact>(),
  {
    id: "name",
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const contact = row.original;
      return (
        <Link
          href={`/contacts/${contact.id}`}
          className="font-medium hover:underline"
        >
          {contact.firstName} {contact.lastName}
        </Link>
      );
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.getValue("email") || "--"}
      </span>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.getValue("phone") || "--"}
      </span>
    ),
  },
  {
    accessorKey: "company",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Company" />
    ),
    cell: ({ row }) => row.getValue("company") || "--",
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <StatusBadge
        status={row.getValue("type")}
        colorMap={CONTACT_TYPE_COLORS}
      />
    ),
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const tags = row.getValue("tags") as string[];
      if (!tags || tags.length === 0) return "--";
      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{tags.length - 3}
            </Badge>
          )}
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
      format(new Date(row.getValue("createdAt")), "dd MMM yyyy"),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell contact={row.original} />,
  },
];

// ============================================================
// ContactsTable Component
// ============================================================

interface ContactsTableProps {
  data: Contact[];
}

function ExportButton() {
  const [loading, setLoading] = React.useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const result = await exportContacts();
      if (result.success) {
        const csv = toCSV(result.data.headers, result.data.rows);
        downloadCSV(`contacts-${new Date().toISOString().split("T")[0]}.csv`, csv);
        toast.success("Contacts exported successfully");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to export contacts");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      <DownloadIcon className="mr-2 size-4" />
      {loading ? "Exporting..." : "Export CSV"}
    </Button>
  );
}

export function ContactsTable({ data }: ContactsTableProps) {
  const router = useRouter();
  const [selectedRows, setSelectedRows] = React.useState<Contact[]>([]);
  const [bulkWhatsAppOpen, setBulkWhatsAppOpen] = React.useState(false);
  const [bulkWhatsAppIds, setBulkWhatsAppIds] = React.useState<string[]>([]);

  const selectedIds = React.useMemo(
    () => selectedRows.map((r) => r.id),
    [selectedRows]
  );

  const bulkActions = React.useMemo(
    () => [
      {
        id: "set-corporate",
        label: "Set Corporate",
        icon: TagIcon,
        onClick: async (ids: string[]) => {
          const result = await bulkUpdateContacts({
            ids,
            data: { type: "CORPORATE" },
          });
          if (result.success) {
            toast.success(`Updated ${result.data.count} contacts`);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        },
      },
      {
        id: "set-individual",
        label: "Set Individual",
        icon: TagIcon,
        onClick: async (ids: string[]) => {
          const result = await bulkUpdateContacts({
            ids,
            data: { type: "INDIVIDUAL" },
          });
          if (result.success) {
            toast.success(`Updated ${result.data.count} contacts`);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        },
      },
      {
        id: "bulk-whatsapp",
        label: "Send WhatsApp",
        icon: MessageCircle,
        onClick: async (ids: string[]) => {
          setBulkWhatsAppIds(ids);
          setBulkWhatsAppOpen(true);
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: BulkTrashIcon,
        variant: "destructive" as const,
        requireConfirm: true,
        confirmTitle: "Delete Contacts",
        confirmDescription: `Are you sure you want to delete ${selectedRows.length} contact(s)? This action cannot be undone.`,
        onClick: async (ids: string[]) => {
          const result = await bulkDeleteContacts({ ids });
          if (result.success) {
            toast.success(`Deleted ${result.data.count} contacts`);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        },
      },
    ],
    [router, selectedRows.length]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchKey="name"
        searchPlaceholder="Search contacts by name..."
        enableRowSelection
        onSelectionChange={setSelectedRows}
        getRowId={(row) => row.id}
        toolbarExtra={
          <div className="flex items-center gap-2">
            <SavedViewSelector entityType="CONTACT" />
            <ExportButton />
          </div>
        }
      />
      <BulkActionBar
        selectedCount={selectedRows.length}
        selectedIds={selectedIds}
        actions={bulkActions}
        onClearSelection={() => setSelectedRows([])}
      />
      <BulkWhatsAppDialog
        selectedContactIds={bulkWhatsAppIds}
        open={bulkWhatsAppOpen}
        onOpenChange={setBulkWhatsAppOpen}
      />
    </>
  );
}
