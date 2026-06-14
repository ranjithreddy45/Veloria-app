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
  StarIcon,
  StoreIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table";
import { FacetFilterRail, type FacetDef } from "@/components/shared/facet-filter-rail";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { DotAvatar } from "@/components/shared/dot-avatar";
import { EmptyState } from "@/components/ui/empty-state";
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
import { deleteVendor } from "@/actions/vendor.actions";
import { VENDOR_CATEGORY_LABELS } from "@/lib/constants";

// ============================================================
// Vendor Type (matching Prisma Vendor model)
// ============================================================

interface Vendor {
  id: string;
  name: string;
  category: string;
  status: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  rating: number;
  totalBookings: number;
  tags: string[];
  _count: {
    bookingVendors: number;
    bids: number;
  };
}

// ============================================================
// Display helpers — labels + hues for status / category
// ============================================================

const VENDOR_STATUS_HUE: Record<string, Hue> = {
  ACTIVE: "emerald",
  INACTIVE: "neutral",
  BLACKLISTED: "red",
  PENDING_APPROVAL: "amber",
};

const VENDOR_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  BLACKLISTED: "Blacklisted",
  PENDING_APPROVAL: "Pending",
};

const VENDOR_CATEGORY_HUE: Record<string, Hue> = {
  CATERING: "amber",
  DECORATION: "pink",
  PHOTOGRAPHY: "indigo",
  VIDEOGRAPHY: "violet",
  ENTERTAINMENT: "rose",
  FLORIST: "emerald",
  TRANSPORTATION: "blue",
  LIGHTING: "orange",
  SOUND: "cyan",
  SECURITY: "slate",
  CLEANING: "teal",
  RENTAL: "purple",
  OTHER: "neutral",
};

function categoryLabel(value: string): string {
  return VENDOR_CATEGORY_LABELS[value] ?? value;
}

function statusLabel(value: string): string {
  return VENDOR_STATUS_LABEL[value] ?? value;
}

// Zoho-style "Filter by" facets — derived from existing vendor fields.
const VENDOR_FACETS: FacetDef<Vendor>[] = [
  { key: "category", label: "Category", get: (v) => v.category, format: categoryLabel, max: 8 },
  { key: "status", label: "Status", get: (v) => v.status, format: statusLabel },
  { key: "rating", label: "Rating", get: (v) => (v.rating > 0 ? `${v.rating}` : null), format: (r) => `${r} star${r === "1" ? "" : "s"}` },
];

// ============================================================
// Identity cell — avatar initials + name + company subtitle
// ============================================================

function IdentityCell({ vendor }: { vendor: Vendor }) {
  const subtitle = vendor.company || categoryLabel(vendor.category);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <DotAvatar seed={vendor.id} name={vendor.name} size="md" />
      <div className="min-w-0 leading-tight">
        <Link
          href={`/vendors/${vendor.id}`}
          className="block truncate text-[13px] font-medium text-foreground hover:underline"
        >
          {vendor.name}
        </Link>
        <span className="block truncate text-[11.5px] text-muted-foreground">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Star Rating Display
// ============================================================

function StarRating({ rating }: { rating: number }) {
  if (!rating) {
    return <span className="text-muted-foreground/60 text-[12px]">Unrated</span>;
  }
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          className={
            i < rating
              ? "size-3.5 fill-amber-400 text-amber-400"
              : "size-3.5 fill-muted text-muted"
          }
        />
      ))}
    </div>
  );
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ vendor }: { vendor: Vendor }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteVendor(vendor.id);
    if (result.success) {
      toast.success("Vendor deleted successfully");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" className="size-7 text-muted-foreground hover:text-foreground">
            <MoreHorizontalIcon className="size-3.5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/vendors/${vendor.id}`}>
              <EyeIcon className="mr-2 size-3.5" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/vendors/${vendor.id}/edit`}>
              <PencilIcon className="mr-2 size-3.5" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <TrashIcon className="mr-2 size-3.5" />
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{vendor.name}</span>? This action
            cannot be undone.
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

const columns: ColumnDef<Vendor>[] = [
  {
    id: "name",
    accessorFn: (row) => `${row.name} ${row.company ?? ""}`,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => <IdentityCell vendor={row.original} />,
  },
  {
    accessorKey: "category",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    cell: ({ row }) => {
      const category = row.original.category;
      return (
        <StatusPill
          label={categoryLabel(category)}
          hue={VENDOR_CATEGORY_HUE[category] ?? "neutral"}
          size="xs"
        />
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <StatusPill
          label={statusLabel(status)}
          hue={VENDOR_STATUS_HUE[status] ?? "neutral"}
          size="xs"
        />
      );
    },
  },
  {
    accessorKey: "rating",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Rating" />
    ),
    cell: ({ row }) => <StarRating rating={row.original.rating} />,
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
          className="inline-block max-w-[200px] truncate text-[12.5px] text-muted-foreground hover:text-foreground hover:underline"
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
        <span className="text-[12.5px] tabular-nums text-muted-foreground">{phone}</span>
      );
    },
  },
  {
    accessorKey: "totalBookings",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bookings" />
    ),
    cell: ({ row }) => (
      <span className="text-[12.5px] tabular-nums text-muted-foreground">
        {row.original.totalBookings}
      </span>
    ),
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
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell vendor={row.original} />,
    size: 80,
  },
];

// ============================================================
// VendorsTable Component
// ============================================================

interface VendorsTableProps {
  data: Vendor[];
}

export function VendorsTable({ data }: VendorsTableProps) {
  // Rows after the faceted "Filter by" rail (seeded with all rows).
  const [faceted, setFaceted] = React.useState<Vendor[]>(data);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card shadow-card">
        <EmptyState
          icon={<StoreIcon className="size-5" />}
          title="No vendors yet"
          description="Add your first vendor to start building your marketplace."
        />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4">
      <FacetFilterRail
        items={data}
        facets={VENDOR_FACETS}
        onChange={setFaceted}
        className="hidden lg:block"
      />
      <div className="min-w-0 flex-1">
        <DataTable
          columns={columns}
          data={faceted}
          searchKey="name"
          searchPlaceholder="Search vendors by name…"
        />
      </div>
    </div>
  );
}
