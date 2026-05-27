"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  DownloadIcon,
  MailIcon,
  PhoneIcon,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumnHeader, getSelectionColumn } from "@/components/shared/data-table";
import { SavedViewSelector } from "@/components/shared/saved-view-selector";
import { BulkActionBar, TrashIcon as BulkTrashIcon, TagIcon } from "@/components/shared/bulk-action-bar";
import { StatusPill } from "@/components/shared/status-pill";
import { DotAvatar } from "@/components/shared/dot-avatar";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteContact } from "@/actions/contact.actions";
import { bulkDeleteContacts, bulkUpdateContacts } from "@/actions/bulk.actions";
import { exportContacts } from "@/actions/export.actions";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { BulkWhatsAppDialog } from "@/components/shared/bulk-whatsapp-dialog";
import { cn } from "@/lib/utils";

// ============================================================
// Types
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
// Identity cell — avatar + name + company/designation subtitle
// ============================================================

function IdentityCell({ contact }: { contact: Contact }) {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const subtitle =
    contact.company && contact.designation
      ? `${contact.designation} · ${contact.company}`
      : contact.company || contact.designation || contact.city || "—";

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <DotAvatar seed={contact.id} name={fullName} size="md" />
      <div className="min-w-0 leading-tight">
        <Link
          href={`/contacts/${contact.id}`}
          className="block truncate text-[13px] font-medium text-foreground hover:underline"
        >
          {fullName}
        </Link>
        <span className="block truncate text-[11.5px] text-muted-foreground">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Quick actions on hover
// ============================================================

function QuickActions({ contact }: { contact: Contact }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteContact(contact.id);
    if (result.success) {
      toast.success("Contact deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 transition-opacity">
      {contact.email && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `mailto:${contact.email}`;
              }}
            >
              <MailIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px]">
            Email {contact.email}
          </TooltipContent>
        </Tooltip>
      )}
      {contact.phone && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `tel:${contact.phone}`;
              }}
            >
              <PhoneIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px]">
            Call {contact.phone}
          </TooltipContent>
        </Tooltip>
      )}

      <AlertDialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontalIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link href={`/contacts/${contact.id}`}>
                <EyeIcon className="mr-2 size-3.5" /> Open
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/contacts/${contact.id}/edit`}>
                <PencilIcon className="mr-2 size-3.5" /> Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialogTrigger asChild>
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <TrashIcon className="mr-2 size-3.5" /> Delete
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact</AlertDialogTitle>
            <AlertDialogDescription>
              Delete{" "}
              <span className="font-medium">
                {contact.firstName} {contact.lastName}
              </span>
              ? This cannot be undone.
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
    </div>
  );
}

// ============================================================
// Type filter tabs
// ============================================================

type TypeFilter = "ALL" | "INDIVIDUAL" | "CORPORATE";

const TYPE_TABS: Array<{ id: TypeFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "INDIVIDUAL", label: "Individual" },
  { id: "CORPORATE", label: "Corporate" },
];

function TypeTabs({
  data,
  active,
  onChange,
}: {
  data: Contact[];
  active: TypeFilter;
  onChange: (v: TypeFilter) => void;
}) {
  const counts: Record<TypeFilter, number> = {
    ALL: data.length,
    INDIVIDUAL: data.filter((c) => c.type === "INDIVIDUAL").length,
    CORPORATE: data.filter((c) => c.type === "CORPORATE").length,
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
      {TYPE_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[12.5px] font-medium transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground/90"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded px-1 text-[10.5px] tabular-nums",
                isActive
                  ? "bg-background text-foreground/70 ring-1 ring-border"
                  : "text-muted-foreground/70"
              )}
            >
              {counts[tab.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Columns
// ============================================================

const columns: ColumnDef<Contact>[] = [
  getSelectionColumn<Contact>(),
  {
    id: "name",
    accessorFn: (row) => `${row.firstName} ${row.lastName} ${row.company ?? ""}`,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => <IdentityCell contact={row.original} />,
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      const email = row.original.email;
      if (!email) return <span className="text-muted-foreground/60 text-[12px]">—</span>;
      return (
        <a
          href={`mailto:${email}`}
          className="text-[12.5px] text-muted-foreground hover:text-foreground hover:underline truncate inline-block max-w-[200px]"
          onClick={(e) => e.stopPropagation()}
        >
          {email}
        </a>
      );
    },
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => {
      const phone = row.original.phone;
      if (!phone) return <span className="text-muted-foreground/60 text-[12px]">—</span>;
      return (
        <span className="text-[12.5px] text-muted-foreground tabular-nums">{phone}</span>
      );
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const t = row.original.type;
      return (
        <StatusPill
          label={t === "CORPORATE" ? "Corporate" : "Individual"}
          hue={t === "CORPORATE" ? "violet" : "blue"}
          size="xs"
        />
      );
    },
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const tags = row.original.tags;
      if (!tags || tags.length === 0) {
        return <span className="text-muted-foreground/60 text-[12px]">—</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 2).map((tag) => (
            <StatusPill key={tag} label={tag} hue="neutral" size="xs" noDot />
          ))}
          {tags.length > 2 && (
            <span className="text-[11px] text-muted-foreground">
              +{tags.length - 2}
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Added" />
    ),
    cell: ({ row }) => (
      <span className="text-[12px] text-muted-foreground">
        {formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })}
      </span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <QuickActions contact={row.original} />,
    size: 120,
  },
];

// ============================================================
// Toolbar buttons
// ============================================================

function ExportButton() {
  const [loading, setLoading] = React.useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const result = await exportContacts();
      if (result.success) {
        const csv = toCSV(result.data.headers, result.data.rows);
        downloadCSV(`contacts-${new Date().toISOString().split("T")[0]}.csv`, csv);
        toast.success("Contacts exported");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      <DownloadIcon className="size-3.5" />
      {loading ? "Exporting…" : "Export"}
    </Button>
  );
}

// ============================================================
// Main table
// ============================================================

interface ContactsTableProps {
  data: Contact[];
}

export function ContactsTable({ data }: ContactsTableProps) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("ALL");
  const [selectedRows, setSelectedRows] = React.useState<Contact[]>([]);
  const [bulkWhatsAppOpen, setBulkWhatsAppOpen] = React.useState(false);
  const [bulkWhatsAppIds, setBulkWhatsAppIds] = React.useState<string[]>([]);

  const filtered = React.useMemo(() => {
    if (typeFilter === "ALL") return data;
    return data.filter((c) => c.type === typeFilter);
  }, [data, typeFilter]);

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
          const result = await bulkUpdateContacts({ ids, data: { type: "CORPORATE" } });
          if (result.success) {
            toast.success(`Updated ${result.data.count} contacts`);
            router.refresh();
          } else toast.error(result.error);
        },
      },
      {
        id: "set-individual",
        label: "Set Individual",
        icon: TagIcon,
        onClick: async (ids: string[]) => {
          const result = await bulkUpdateContacts({ ids, data: { type: "INDIVIDUAL" } });
          if (result.success) {
            toast.success(`Updated ${result.data.count} contacts`);
            router.refresh();
          } else toast.error(result.error);
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
        confirmTitle: "Delete contacts",
        confirmDescription: `Delete ${selectedRows.length} contact(s)? This cannot be undone.`,
        onClick: async (ids: string[]) => {
          const result = await bulkDeleteContacts({ ids });
          if (result.success) {
            toast.success(`Deleted ${result.data.count} contacts`);
            router.refresh();
          } else toast.error(result.error);
        },
      },
    ],
    [router, selectedRows.length]
  );

  return (
    <>
      <TypeTabs data={data} active={typeFilter} onChange={setTypeFilter} />
      <DataTable
        columns={columns}
        data={filtered}
        searchKey="name"
        searchPlaceholder="Search contacts…"
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
