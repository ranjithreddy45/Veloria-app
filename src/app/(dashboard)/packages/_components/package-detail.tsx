"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  PencilIcon,
  CopyIcon,
  TrashIcon,
  PackageIcon,
  CheckCircleIcon,
  CircleIcon,
  IndianRupeeIcon,
  TagIcon,
  CalendarIcon,
} from "lucide-react";

import { duplicatePackage, deletePackage, togglePackageStatus } from "@/actions/package.actions";
import { PACKAGE_TIER_COLORS } from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
// PackageDetail Props
// ============================================================

interface PackageDetailProps {
  eventPackage: {
    id: string;
    name: string;
    description: string | null;
    eventType: string | null;
    basePrice: number;
    tier: string;
    isActive: boolean;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
    items: {
      id: string;
      name: string;
      description: string | null;
      category: string | null;
      quantity: number;
      unitPrice: number;
      isIncluded: boolean;
      order: number;
    }[];
  };
}

// ============================================================
// PackageDetail Component
// ============================================================

export function PackageDetail({ eventPackage }: PackageDetailProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isToggling, setIsToggling] = React.useState(false);
  const [isActive, setIsActive] = React.useState(eventPackage.isActive);

  const includedItems = eventPackage.items.filter((item) => item.isIncluded);
  const optionalItems = eventPackage.items.filter((item) => !item.isIncluded);

  const includedTotal = includedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const optionalTotal = optionalItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  async function handleDuplicate() {
    try {
      const result = await duplicatePackage(eventPackage.id);
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
      const result = await deletePackage(eventPackage.id);
      if (result.success) {
        toast.success("Package deleted successfully");
        router.push("/packages");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete package");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleToggleActive() {
    setIsToggling(true);
    try {
      const result = await togglePackageStatus(eventPackage.id);
      if (result.success) {
        setIsActive(result.data.isActive);
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

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {eventPackage.name}
              </h1>
              <StatusBadge
                status={eventPackage.tier}
                colorMap={PACKAGE_TIER_COLORS}
              />
              <Badge
                variant="outline"
                className={
                  isActive
                    ? "border-green-200 bg-green-100 text-green-800"
                    : "border-zinc-200 bg-zinc-100 text-zinc-600"
                }
              >
                {isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            {eventPackage.eventType && (
              <p className="text-muted-foreground mt-1 text-sm">
                {eventPackage.eventType}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/packages/${eventPackage.id}/edit`}>
                <PencilIcon className="mr-2 size-4" />
                Edit
              </Link>
            </Button>
            <Button variant="outline" onClick={handleDuplicate}>
              <CopyIcon className="mr-2 size-4" />
              Duplicate
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <TrashIcon className="mr-2 size-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Package Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Package Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {eventPackage.description && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {eventPackage.description}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3">
                <IndianRupeeIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Base Price</p>
                  <p className="text-sm font-medium">
                    {formatINR(eventPackage.basePrice)}
                  </p>
                </div>
              </div>
              {eventPackage.eventType && (
                <div className="flex items-center gap-3">
                  <TagIcon className="text-muted-foreground size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Event Type</p>
                    <p className="text-sm font-medium">{eventPackage.eventType}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <PackageIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Total Items</p>
                  <p className="text-sm font-medium">
                    {eventPackage.items.length} items ({includedItems.length} included,{" "}
                    {optionalItems.length} optional)
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Switch
                  checked={isActive}
                  onCheckedChange={handleToggleActive}
                  disabled={isToggling}
                />
                <Label className="cursor-pointer" onClick={handleToggleActive}>
                  {isActive ? "Active" : "Inactive"}
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Included Items ({includedItems.length})
                </span>
                <span className="font-medium">{formatINR(includedTotal)}</span>
              </div>
              {optionalItems.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Optional Items ({optionalItems.length})
                  </span>
                  <span className="font-medium text-zinc-400">
                    +{formatINR(optionalTotal)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">Base Price</span>
                <span className="text-lg font-bold">
                  {formatINR(eventPackage.basePrice)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="text-sm">{formatDate(eventPackage.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Last Updated</p>
                  <p className="text-sm">{formatDate(eventPackage.updatedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Included Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircleIcon className="size-4 text-green-600" />
              Included Items ({includedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {includedItems.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No included items in this package.
              </p>
            ) : (
              <div className="space-y-3">
                {includedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border p-3 dark:border-zinc-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.category && (
                          <Badge variant="secondary" className="text-xs">
                            {item.category}
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-medium">
                        {formatINR(item.unitPrice * item.quantity)}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {item.quantity} x {formatINR(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Optional Items */}
        {optionalItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CircleIcon className="size-4 text-zinc-400" />
                Optional Add-ons ({optionalItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {optionalItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-dashed p-3 dark:border-zinc-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.category && (
                          <Badge variant="secondary" className="text-xs">
                            {item.category}
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-medium">
                        +{formatINR(item.unitPrice * item.quantity)}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {item.quantity} x {formatINR(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{eventPackage.name}&quot;? This
              action cannot be undone. All items in this package will also be
              deleted.
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
