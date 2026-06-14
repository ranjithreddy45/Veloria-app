"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ListIcon,
  MoreVerticalIcon,
  PencilIcon,
  CopyIcon,
  TrashIcon,
  EyeIcon,
} from "lucide-react";

import { togglePackageStatus, duplicatePackage, deletePackage } from "@/actions/package.actions";
import { PACKAGE_TIER_COLORS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ============================================================
// PackageCard Props
// ============================================================

interface PackageCardProps {
  pkg: {
    id: string;
    name: string;
    description: string | null;
    eventType: string | null;
    basePrice: number;
    tier: string;
    isActive: boolean;
    imageUrl: string | null;
    _count: { items: number };
  };
}

// ============================================================
// PackageCard Component
// ============================================================

export function PackageCard({ pkg }: PackageCardProps) {
  const router = useRouter();
  const [isToggling, setIsToggling] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  async function handleToggleActive() {
    setIsToggling(true);
    try {
      const result = await togglePackageStatus(pkg.id);
      if (result.success) {
        toast.success(
          result.data.isActive ? "Package activated" : "Package deactivated"
        );
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to update package status");
    } finally {
      setIsToggling(false);
    }
  }

  async function handleDuplicate() {
    try {
      const result = await duplicatePackage(pkg.id);
      if (result.success) {
        toast.success("Package duplicated successfully");
        router.push(`/packages/${result.data.id}/edit`);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to duplicate package");
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const result = await deletePackage(pkg.id);
      if (result.success) {
        toast.success("Package deleted successfully");
        setShowDeleteDialog(false);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete package");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Card className="group relative flex flex-col shadow-card transition-shadow hover:shadow-card-hover">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <StatusBadge
              status={pkg.tier}
              colorMap={PACKAGE_TIER_COLORS}
            />
            {pkg.eventType && (
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {pkg.eventType}
              </span>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
              >
                <MoreVerticalIcon className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/packages/${pkg.id}`}>
                  <EyeIcon className="mr-2 size-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/packages/${pkg.id}/edit`}>
                  <PencilIcon className="mr-2 size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <CopyIcon className="mr-2 size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 focus:text-red-600"
              >
                <TrashIcon className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-3 pt-0">
          {/* Package Name */}
          <Link
            href={`/packages/${pkg.id}`}
            className="hover:underline"
          >
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
              {pkg.name}
            </h3>
          </Link>

          {/* Description */}
          {pkg.description && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
              {pkg.description}
            </p>
          )}

          {/* Item Count */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ListIcon className="size-3.5 shrink-0" />
            <span className="tabular-nums">
              {pkg._count.items} {pkg._count.items === 1 ? "item" : "items"}
            </span>
          </div>

          {/* Price & Active Toggle */}
          <div className="mt-auto flex items-center justify-between border-t pt-3 dark:border-zinc-800">
            <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatINR(pkg.basePrice)}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {pkg.isActive ? "Active" : "Inactive"}
              </span>
              <Switch
                checked={pkg.isActive}
                onCheckedChange={handleToggleActive}
                disabled={isToggling}
                size="sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{pkg.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              variant="destructive"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
