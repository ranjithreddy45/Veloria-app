"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  PackageIcon,
  MapPinIcon,
  TagIcon,
  AlertTriangleIcon,
  CalendarIcon,
  HashIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RESERVATION_STATUS_COLORS,
  BOOKING_STATUS_COLORS,
} from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";
import { releaseReservation } from "@/actions/inventory.actions";

// ============================================================
// Types
// ============================================================

interface Reservation {
  id: string;
  quantity: number;
  date: string;
  returnDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
    date: string;
    status: string;
  };
}

interface InventoryDetailData {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  description: string | null;
  totalQuantity: number;
  availableQty: number;
  reorderLevel: number;
  unitCost: number | null;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  reservations: Reservation[];
}

interface InventoryDetailProps {
  item: InventoryDetailData;
}

// ============================================================
// ReservationRow Component
// ============================================================

function ReservationRow({ reservation }: { reservation: Reservation }) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [releaseStatus, setReleaseStatus] = React.useState<string>("");

  const canRelease =
    reservation.status === "RESERVED" || reservation.status === "IN_USE";

  const handleRelease = async () => {
    if (!releaseStatus) {
      toast.error("Please select a return status");
      return;
    }
    setIsPending(true);
    try {
      const result = await releaseReservation(reservation.id, {
        status: releaseStatus as "RETURNED" | "DAMAGED",
      });
      if (result.success) {
        toast.success("Reservation released successfully");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to release reservation");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <Link
          href={`/bookings/${reservation.booking.id}`}
          className="font-medium hover:underline"
        >
          {reservation.booking.bookingNumber} -{" "}
          {reservation.booking.eventName}
        </Link>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <span>Qty: {reservation.quantity}</span>
          <span>
            Date: {format(new Date(reservation.date), "dd MMM yyyy")}
          </span>
          {reservation.returnDate && (
            <span>
              Return: {format(new Date(reservation.returnDate), "dd MMM yyyy")}
            </span>
          )}
          {reservation.notes && <span>Notes: {reservation.notes}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge
          status={reservation.booking.status}
          colorMap={BOOKING_STATUS_COLORS}
        />
        <StatusBadge
          status={reservation.status}
          colorMap={RESERVATION_STATUS_COLORS}
        />
        {canRelease && (
          <div className="flex items-center gap-1">
            <Select
              value={releaseStatus}
              onValueChange={setReleaseStatus}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue placeholder="Release..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RETURNED">Returned</SelectItem>
                <SelectItem value="DAMAGED">Damaged</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRelease}
              disabled={isPending || !releaseStatus}
              className="h-8 text-xs"
            >
              {isPending ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : (
                "Release"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// InventoryDetail Component
// ============================================================

export function InventoryDetail({ item }: InventoryDetailProps) {
  const stockPercent =
    item.totalQuantity > 0
      ? Math.round((item.availableQty / item.totalQuantity) * 100)
      : 0;
  const isLowStock = item.availableQty <= item.reorderLevel;
  const reservedQty = item.totalQuantity - item.availableQty;

  const activeReservations = item.reservations.filter(
    (r) => r.status === "RESERVED" || r.status === "IN_USE"
  );
  const pastReservations = item.reservations.filter(
    (r) => r.status === "RETURNED" || r.status === "DAMAGED"
  );

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="reservations">
          Reservations ({item.reservations.length})
        </TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="mt-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Stock Level Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageIcon className="size-4" />
                Stock Level
                {isLowStock && (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-700"
                  >
                    <AlertTriangleIcon className="mr-1 size-3" />
                    Low Stock
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Available</span>
                  <span
                    className={`font-semibold ${
                      isLowStock ? "text-amber-600" : "text-green-600"
                    }`}
                  >
                    {item.availableQty}
                  </span>
                </div>
                <Progress
                  value={stockPercent}
                  className={`h-3 ${
                    isLowStock
                      ? "[&>[data-slot=progress-indicator]]:bg-amber-500"
                      : "[&>[data-slot=progress-indicator]]:bg-green-500"
                  }`}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>{item.totalQuantity} total</span>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{item.totalQuantity}</p>
                  <p className="text-muted-foreground text-xs">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{reservedQty}</p>
                  <p className="text-muted-foreground text-xs">Reserved</p>
                </div>
                <div>
                  <p
                    className={`text-2xl font-bold ${
                      isLowStock ? "text-amber-600" : ""
                    }`}
                  >
                    {item.availableQty}
                  </p>
                  <p className="text-muted-foreground text-xs">Available</p>
                </div>
              </div>
              {isLowStock && (
                <>
                  <Separator />
                  <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangleIcon className="size-4" />
                      <span className="font-medium">Low Stock Warning</span>
                    </div>
                    <p className="mt-1 text-xs">
                      Available quantity ({item.availableQty}) is at or below
                      the reorder level ({item.reorderLevel}). Consider
                      restocking.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Item Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Item Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <TagIcon className="text-muted-foreground size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Category</p>
                  <p className="text-sm">{item.category}</p>
                </div>
              </div>
              {item.sku && (
                <div className="flex items-center gap-3">
                  <HashIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">SKU</p>
                    <p className="font-mono text-sm">{item.sku}</p>
                  </div>
                </div>
              )}
              {item.location && (
                <div className="flex items-center gap-3">
                  <MapPinIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Location</p>
                    <p className="text-sm">{item.location}</p>
                  </div>
                </div>
              )}
              {item.unitCost != null && (
                <div className="flex items-center gap-3">
                  <div className="size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Unit Cost</p>
                    <p className="text-sm">{formatINR(item.unitCost)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge
                    variant={item.isActive ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Reorder Level</p>
                  <p className="text-sm">{item.reorderLevel}</p>
                </div>
              </div>
              {item.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">
                      Description
                    </p>
                    <p className="text-sm">{item.description}</p>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex items-center gap-3">
                <CalendarIcon className="text-muted-foreground size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="text-sm">{formatDate(item.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Reservations Tab */}
      <TabsContent value="reservations" className="mt-6 space-y-6">
        {/* Active Reservations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Active Reservations ({activeReservations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeReservations.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No active reservations.
              </p>
            ) : (
              <div className="space-y-3">
                {activeReservations.map((reservation) => (
                  <ReservationRow
                    key={reservation.id}
                    reservation={reservation}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Reservations */}
        {pastReservations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Past Reservations ({pastReservations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pastReservations.map((reservation) => (
                  <ReservationRow
                    key={reservation.id}
                    reservation={reservation}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
