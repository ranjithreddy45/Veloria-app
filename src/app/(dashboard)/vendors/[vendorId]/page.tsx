import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { getVendor } from "@/actions/vendor.actions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VendorDetail } from "../_components/vendor-detail";

export const metadata: Metadata = { title: "Vendor Details" };

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
  const result = await getVendor(vendorId);

  if (!result.success || !result.data) {
    notFound();
  }

  const vendor = result.data;

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
        </div>
        <div className="flex items-center gap-2">
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
      />
    </div>
  );
}
