"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PackageIcon,
  CalendarIcon,
  IndianRupeeIcon,
  LayersIcon,
  WrenchIcon,
  ImageIcon,
  CheckCircleIcon,
  Loader2Icon,
} from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RENTAL_STATUS_COLORS, BOOKING_STATUS_COLORS } from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";
import { returnItem } from "@/actions/rental.actions";

// ============================================================
// Types
// ============================================================

interface RentalBooking {
  id: string;
  quantity: number;
  startDate: string;
  endDate: string;
  dailyRate: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
    date: string;
    status: string;
  };
}

interface RentalItemDetailData {
  id: string;
  name: string;
  category: string;
  description: string | null;
  dailyRate: number;
  weeklyRate: number | null;
  quantity: number;
  availableQty: number;
  condition: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  rentals: RentalBooking[];
}

interface RentalDetailProps {
  item: RentalItemDetailData;
}

// ============================================================
// Return Button Component
// ============================================================

function ReturnButton({ rentalBookingId }: { rentalBookingId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const handleReturn = async () => {
    setIsPending(true);
    try {
      const result = await returnItem(rentalBookingId);
      if (result.success) {
        toast.success("Item returned successfully");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to return item");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleReturn}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2Icon className="mr-1 size-3 animate-spin" />
      ) : (
        <CheckCircleIcon className="mr-1 size-3" />
      )}
      Return
    </Button>
  );
}

// ============================================================
// RentalDetail Component
// ============================================================

export function RentalDetail({ item }: RentalDetailProps) {
  const activeRentals = item.rentals.filter(
    (r) => r.status === "RESERVED" || r.status === "RENTED" || r.status === "OVERDUE"
  );
  const pastRentals = item.rentals.filter((r) => r.status === "RETURNED");
  const utilizationPct =
    item.quantity > 0
      ? Math.round(
          ((item.quantity - item.availableQty) / item.quantity) * 100
        )
      : 0;

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="active">
          Active ({activeRentals.length})
        </TabsTrigger>
        <TabsTrigger value="history">
          History ({pastRentals.length})
        </TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="mt-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Item Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Item Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <PackageIcon className="text-muted-foreground size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Category</p>
                  <Badge variant="secondary">{item.category}</Badge>
                </div>
              </div>
              {item.description && (
                <div className="flex items-start gap-3">
                  <LayersIcon className="text-muted-foreground mt-0.5 size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Description</p>
                    <p className="text-sm">{item.description}</p>
                  </div>
                </div>
              )}
              {item.condition && (
                <div className="flex items-center gap-3">
                  <WrenchIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Condition</p>
                    <p className="text-sm">{item.condition}</p>
                  </div>
                </div>
              )}
              {item.imageUrl && (
                <div className="flex items-center gap-3">
                  <ImageIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Image</p>
                    <a
                      href={item.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View Image
                    </a>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <CalendarIcon className="text-muted-foreground size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="text-sm">{formatDate(item.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Availability & Pricing Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Availability & Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-muted-foreground mb-1 text-xs">
                  Availability
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {item.availableQty}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    of {item.quantity} available
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      utilizationPct > 80
                        ? "bg-red-500"
                        : utilizationPct > 50
                          ? "bg-amber-500"
                          : "bg-green-500"
                    }`}
                    style={{ width: `${utilizationPct}%` }}
                  />
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {utilizationPct}% utilization
                </p>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <IndianRupeeIcon className="text-muted-foreground size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Daily Rate</p>
                  <p className="text-lg font-semibold">
                    {formatINR(item.dailyRate)}
                  </p>
                </div>
              </div>

              {item.weeklyRate && (
                <div className="flex items-center gap-3">
                  <IndianRupeeIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Weekly Rate</p>
                    <p className="text-lg font-semibold">
                      {formatINR(item.weeklyRate)}
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-muted-foreground mb-1 text-xs">
                  Total Rentals
                </p>
                <p className="text-2xl font-bold">{item.rentals.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Active Rentals Tab */}
      <TabsContent value="active" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Rentals</CardTitle>
          </CardHeader>
          <CardContent>
            {activeRentals.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No active rentals.
              </p>
            ) : (
              <div className="space-y-3">
                {activeRentals.map((rental) => (
                  <div
                    key={rental.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <Link
                        href={`/bookings/${rental.booking.id}`}
                        className="font-medium hover:underline"
                      >
                        {rental.booking.bookingNumber} -{" "}
                        {rental.booking.eventName}
                      </Link>
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span>Qty: {rental.quantity}</span>
                        <span>
                          {formatDate(rental.startDate)} -{" "}
                          {formatDate(rental.endDate)}
                        </span>
                        <span>{formatINR(rental.totalAmount)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={rental.status}
                        colorMap={RENTAL_STATUS_COLORS}
                      />
                      <StatusBadge
                        status={rental.booking.status}
                        colorMap={BOOKING_STATUS_COLORS}
                      />
                      {(rental.status === "RESERVED" ||
                        rental.status === "RENTED" ||
                        rental.status === "OVERDUE") && (
                        <ReturnButton rentalBookingId={rental.id} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* History Tab */}
      <TabsContent value="history" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rental History</CardTitle>
          </CardHeader>
          <CardContent>
            {pastRentals.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No rental history yet.
              </p>
            ) : (
              <div className="space-y-3">
                {pastRentals.map((rental) => (
                  <div
                    key={rental.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <Link
                        href={`/bookings/${rental.booking.id}`}
                        className="font-medium hover:underline"
                      >
                        {rental.booking.bookingNumber} -{" "}
                        {rental.booking.eventName}
                      </Link>
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span>Qty: {rental.quantity}</span>
                        <span>
                          {formatDate(rental.startDate)} -{" "}
                          {formatDate(rental.endDate)}
                        </span>
                        <span>{formatINR(rental.totalAmount)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={rental.status}
                        colorMap={RENTAL_STATUS_COLORS}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
