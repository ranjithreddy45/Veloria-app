import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PencilIcon, PlusIcon } from "lucide-react";

import { getVendor } from "@/actions/vendor.actions";
import { getCatalogVendor } from "@/actions/vendor-catalog.actions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { VENDOR_TYPE_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VendorDetail } from "../_components/vendor-detail";

export const metadata: Metadata = { title: "Vendor Details" };

type CatalogVendor = {
  vendorType: string | null;
  venueIds: string[];
  allVenues: boolean;
  packages: {
    id: string;
    name: string;
    category: string;
    status: string;
    price: number;
    customerPrice: number | null;
    priceUnit: string;
  }[];
};

// ============================================================
// Vendor Detail Page
// ============================================================

interface VendorDetailPageProps {
  params: Promise<{ vendorId: string }>;
}

export default async function VendorDetailPage({
  params,
}: VendorDetailPageProps) {
  const { vendorId } = await params;
  const [result, catalogResult] = await Promise.all([
    getVendor(vendorId),
    getCatalogVendor(vendorId),
  ]);

  if (!result.success || !result.data) {
    notFound();
  }

  const vendor = result.data;

  // Catalog-side view of the SAME vendor row (packages + vendorType + venue scope)
  const catalog = catalogResult.success
    ? (catalogResult.data as CatalogVendor)
    : null;

  // Resolve assigned venue names for display
  const venueNames =
    catalog && !catalog.allVenues && catalog.venueIds.length > 0
      ? (
          await prisma.venue.findMany({
            where: { id: { in: catalog.venueIds } },
            select: { name: true },
            orderBy: { name: "asc" },
          })
        ).map((v) => v.name)
      : [];

  const vendorTypeLabel = VENDOR_TYPE_LABELS[catalog?.vendorType ?? "EXTERNAL"] ?? "External vendor";
  const venueScopeLabel = catalog?.allVenues
    ? "All venues"
    : venueNames.length > 0
      ? `${venueNames.length} venue${venueNames.length === 1 ? "" : "s"}`
      : "No venues assigned";

  // Fetch available bookings for assignment dialog
  const bookings = await prisma.booking.findMany({
    where: {
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    select: {
      id: true,
      bookingNumber: true,
      eventName: true,
    },
    orderBy: { date: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {vendor.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {vendor.company
              ? `${vendor.company}`
              : "Vendor Details"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[11px] font-medium">
              {vendorTypeLabel}
            </Badge>
            <Badge variant="outline" className="text-[11px]" title={venueNames.join(", ")}>
              {venueScopeLabel}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href={`/vendors/packages/new?vendorId=${vendor.id}`}>
              <PlusIcon className="mr-2 size-4" />
              Add package
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/vendors/${vendor.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <VendorDetail
        vendor={vendor}
        availableBookings={serialize(bookings)}
        packages={catalog?.packages ?? []}
      />
    </div>
  );
}
