"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  MailIcon,
  PhoneIcon,
  BuildingIcon,
  MapPinIcon,
  GlobeIcon,
  CalendarIcon,
  HashIcon,
  TagIcon,
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
import { Separator } from "@/components/ui/separator";
import {
  VENDOR_STATUS_COLORS,
  VENDOR_CATEGORY_LABELS,
  VENDOR_ASSIGNMENT_STATUS_COLORS,
  BOOKING_STATUS_COLORS,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { VendorRating } from "./vendor-rating";
import { BidList } from "./bid-list";
import { AssignVendorDialog } from "./assign-vendor-dialog";

// ============================================================
// Vendor Detail Types
// ============================================================

interface BookingVendor {
  id: string;
  role: string | null;
  agreedRate: number | null;
  status: string;
  createdAt: string | Date;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
    date: string | Date;
    status: string;
  };
}

interface VendorBid {
  id: string;
  amount: number;
  message: string | null;
  status: string;
  submittedAt: string | Date;
  respondedAt: string | Date | null;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
    date: string | Date;
  };
}

interface VendorDetailData {
  id: string;
  name: string;
  category: string;
  status: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  gstin: string | null;
  website: string | null;
  rating: number;
  totalBookings: number;
  tags: string[];
  createdAt: string | Date;
  bookingVendors: BookingVendor[];
  bids: VendorBid[];
}

interface AvailableBooking {
  id: string;
  bookingNumber: string;
  eventName: string;
}

interface VendorDetailProps {
  vendor: VendorDetailData;
  availableBookings: AvailableBooking[];
}

// ============================================================
// VendorDetail Component
// ============================================================

export function VendorDetail({ vendor, availableBookings }: VendorDetailProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="bookings">
          Bookings ({vendor.bookingVendors.length})
        </TabsTrigger>
        <TabsTrigger value="bids">
          Bids ({vendor.bids.length})
        </TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="mt-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Vendor Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendor Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <TagIcon className="text-muted-foreground size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Category</p>
                  <p className="text-sm">
                    {VENDOR_CATEGORY_LABELS[vendor.category] ?? vendor.category}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <StatusBadge
                    status={vendor.status}
                    colorMap={VENDOR_STATUS_COLORS}
                  />
                </div>
              </div>
              {vendor.email && (
                <div className="flex items-center gap-3">
                  <MailIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="text-sm">{vendor.email}</p>
                  </div>
                </div>
              )}
              {vendor.phone && (
                <div className="flex items-center gap-3">
                  <PhoneIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <p className="text-sm">{vendor.phone}</p>
                  </div>
                </div>
              )}
              {vendor.company && (
                <div className="flex items-center gap-3">
                  <BuildingIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Company</p>
                    <p className="text-sm">{vendor.company}</p>
                  </div>
                </div>
              )}
              {vendor.address && (
                <div className="flex items-center gap-3">
                  <MapPinIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Address</p>
                    <p className="text-sm">{vendor.address}</p>
                  </div>
                </div>
              )}
              {vendor.website && (
                <div className="flex items-center gap-3">
                  <GlobeIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Website</p>
                    <a
                      href={vendor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {vendor.website}
                    </a>
                  </div>
                </div>
              )}
              {vendor.gstin && (
                <div className="flex items-center gap-3">
                  <HashIcon className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">GSTIN</p>
                    <p className="text-sm font-mono">{vendor.gstin}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <CalendarIcon className="text-muted-foreground size-4" />
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="text-sm">
                    {format(new Date(vendor.createdAt), "dd MMM yyyy")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rating, Tags & Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rating & Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-muted-foreground mb-2 text-xs">Rating</p>
                <VendorRating
                  vendorId={vendor.id}
                  currentRating={vendor.rating}
                  size="lg"
                />
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2 text-xs">
                  Total Bookings
                </p>
                <p className="text-2xl font-bold">{vendor.totalBookings}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2 text-xs">Tags</p>
                {vendor.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {vendor.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No tags</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Bookings Tab */}
      <TabsContent value="bookings" className="mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Assigned Bookings</CardTitle>
            <AssignVendorDialog
              vendorId={vendor.id}
              vendorName={vendor.name}
              bookings={availableBookings}
            />
          </CardHeader>
          <CardContent>
            {vendor.bookingVendors.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No booking assignments yet.
              </p>
            ) : (
              <div className="space-y-3">
                {vendor.bookingVendors.map((bv) => (
                  <div
                    key={bv.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <Link
                        href={`/bookings/${bv.booking.id}`}
                        className="font-medium hover:underline"
                      >
                        {bv.booking.bookingNumber} - {bv.booking.eventName}
                      </Link>
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span>
                          {format(
                            new Date(bv.booking.date),
                            "dd MMM yyyy"
                          )}
                        </span>
                        {bv.role && <span>Role: {bv.role}</span>}
                        {bv.agreedRate !== null && (
                          <span>Rate: {formatINR(bv.agreedRate)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={bv.booking.status}
                        colorMap={BOOKING_STATUS_COLORS}
                      />
                      <StatusBadge
                        status={bv.status}
                        colorMap={VENDOR_ASSIGNMENT_STATUS_COLORS}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Bids Tab */}
      <TabsContent value="bids" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submitted Bids</CardTitle>
          </CardHeader>
          <CardContent>
            <BidList bids={vendor.bids} showBooking />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
