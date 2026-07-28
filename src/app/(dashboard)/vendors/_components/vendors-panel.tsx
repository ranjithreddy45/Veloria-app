"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  StoreIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  PackageIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  VENDOR_MODULE_CATEGORY_LABELS,
  VENDOR_TYPE_LABELS,
} from "@/lib/constants";
import { archiveVendor, restoreVendor } from "@/actions/vendor-catalog.actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { VendorFormDialog } from "./vendor-form-dialog";
import type { VendorRow, CategoryOption, VenueOption } from "./vendor-module";

// ============================================================
// Empanelment badge color map
// ============================================================

const EMPANELMENT_COLORS: Record<string, string> = {
  empanelled:
    "bg-success/12 text-success border-success/25",
  probation:
    "bg-warning/14 text-warning border-warning/25",
  suspended: "bg-destructive/12 text-destructive border-destructive/25",
};

const EMPANELMENT_LABELS: Record<string, string> = {
  empanelled: "Empanelled",
  probation: "Probation",
  suspended: "Suspended",
};

// ============================================================
// Category chip hue (for multi-category chips on the card)
// ============================================================

const CATEGORY_HUE: Record<string, string> = {
  decor: "bg-pink-500/12 text-pink-700 border-pink-500/25 dark:text-pink-300",
  catering: "bg-amber-500/14 text-amber-700 border-amber-500/25 dark:text-amber-300",
  emcee: "bg-violet-500/12 text-violet-700 border-violet-500/25 dark:text-violet-300",
  photography: "bg-indigo-500/12 text-indigo-700 border-indigo-500/25 dark:text-indigo-300",
  av_lighting: "bg-orange-500/12 text-orange-700 border-orange-500/25 dark:text-orange-300",
  entertainment: "bg-rose-500/12 text-rose-700 border-rose-500/25 dark:text-rose-300",
};

// ============================================================
// VendorCard
// ============================================================

interface VendorCardProps {
  vendor: VendorRow;
  categories: CategoryOption[];
  venues: VenueOption[];
}

function VendorCard({ vendor, categories, venues }: VendorCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleArchive = () => {
    startTransition(async () => {
      const res = await archiveVendor(vendor.id);
      if (res.success) {
        toast.success(`"${vendor.name}" archived`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const res = await restoreVendor(vendor.id);
      if (res.success) {
        toast.success(`"${vendor.name}" restored`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const empanelStatus = vendor.empanelmentStatus ?? "empanelled";
  const catLabel = (key: string) =>
    categories.find((c) => c.key === key)?.label ??
    VENDOR_MODULE_CATEGORY_LABELS[key] ??
    key;
  const venueScopeLabel = vendor.allVenues
    ? "All venues"
    : vendor.venueIds.length > 0
      ? `${vendor.venueIds.length} venue${vendor.venueIds.length === 1 ? "" : "s"}`
      : "No venues";

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover",
        vendor.isArchived && "opacity-60"
      )}
    >
      {/* ── Header: name + empanelment badge ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/vendors/${vendor.id}`}
            className="block truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground hover:underline"
          >
            {vendor.name}
          </Link>
          {vendor.city && (
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
              <MapPinIcon className="size-3 shrink-0" />
              {vendor.city}
            </p>
          )}
        </div>

        <Badge
          variant="outline"
          className={cn(
            "shrink-0 gap-1 border text-[11px] font-medium",
            EMPANELMENT_COLORS[empanelStatus] ?? "bg-muted text-foreground border-border"
          )}
        >
          <span className="inline-block size-1.5 rounded-full bg-current opacity-70" aria-hidden />
          {EMPANELMENT_LABELS[empanelStatus] ?? empanelStatus}
        </Badge>
      </div>

      {/* ── Category chips ── */}
      {vendor.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {vendor.categories.map((cat) => (
            <span
              key={cat}
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                CATEGORY_HUE[cat] ?? "bg-muted text-muted-foreground border-border"
              )}
            >
              {catLabel(cat)}
            </span>
          ))}
        </div>
      )}

      {/* ── Vendor type + venue scope ── */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-medium">
          {VENDOR_TYPE_LABELS[vendor.vendorType ?? "EXTERNAL"] ?? "External vendor"}
        </span>
        <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5">
          {venueScopeLabel}
        </span>
      </div>

      {/* ── Contact details ── */}
      <div className="flex flex-col gap-1">
        {vendor.email && (
          <a
            href={`mailto:${vendor.email}`}
            className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <MailIcon className="size-3 shrink-0" />
            {vendor.email}
          </a>
        )}
        {vendor.phone && (
          <p className="numeric flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <PhoneIcon className="size-3 shrink-0" />
            {vendor.phone}
          </p>
        )}
        {!vendor.email && !vendor.phone && (
          <p className="text-[12px] text-muted-foreground/50">No contact info</p>
        )}
      </div>

      {/* ── Footer: package count + quality score ── */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <PackageIcon className="size-3 shrink-0" />
            <span className="numeric font-medium text-foreground">{vendor.packageCount}</span>
            {vendor.packageCount === 1 ? " package" : " packages"}
          </span>
        </div>

        {vendor.qualityScore !== null && (
          <Badge
            variant="outline"
            className="border-teal-500/25 bg-teal-500/12 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
          >
            QS <span className="numeric ml-1">{vendor.qualityScore}</span>
          </Badge>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-2">
        <VendorFormDialog
          vendor={vendor}
          categories={categories}
          venues={venues}
          trigger={
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-[12px]"
            >
              Edit
            </Button>
          }
        />

        {vendor.isArchived ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[12px] text-muted-foreground"
            onClick={handleRestore}
            disabled={pending}
          >
            <ArchiveRestoreIcon className="size-3" />
            Restore
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[12px] text-muted-foreground hover:text-destructive"
                disabled={pending}
              >
                <ArchiveIcon className="size-3" />
                Archive
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive vendor?</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="font-medium">{vendor.name}</span> will be hidden from active
                  views. You can restore them later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

// ============================================================
// VendorsPanel
// ============================================================

interface VendorsPanelProps {
  vendors: VendorRow[];
  search: string;
  category: string;
  categories: CategoryOption[];
  venues: VenueOption[];
}

export function VendorsPanel({ vendors, search, category, categories, venues }: VendorsPanelProps) {
  const [showArchived, setShowArchived] = React.useState(false);

  // Client-side filter (no round-trip needed for the initial 100-row page)
  const filtered = React.useMemo(() => {
    let list = vendors;

    if (!showArchived) list = list.filter((v) => !v.isArchived);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.city ?? "").toLowerCase().includes(q) ||
          (v.email ?? "").toLowerCase().includes(q)
      );
    }

    if (category && category !== "all") {
      list = list.filter((v) => v.categories.includes(category));
    }

    return list;
  }, [vendors, search, category, showArchived]);

  const hasArchived = vendors.some((v) => v.isArchived);

  return (
    <div className="space-y-4">
      {/* Show-archived toggle */}
      {hasArchived && (
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="show-archived" className="cursor-pointer text-[13px] text-muted-foreground">
            Show archived vendors
          </Label>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50">
          {vendors.filter((v) => !v.isArchived).length === 0 ? (
            <EmptyState
              icon={<StoreIcon />}
              title="Every great event runs on a good bench"
              description="Add your first empanelled partner and their packages become quotable across the whole app."
            />
          ) : (
            <EmptyState
              icon={<StoreIcon />}
              title="No partners match that search"
              description="Try a different name or city, or clear the category filter to see the full bench."
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v) => (
            <VendorCard key={v.id} vendor={v} categories={categories} venues={venues} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Loading skeleton (optional, export for Suspense)
// ============================================================

export function VendorsPanelSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border bg-card p-5 shadow-card">
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="h-3.5 w-1/2 rounded" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-full rounded" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
