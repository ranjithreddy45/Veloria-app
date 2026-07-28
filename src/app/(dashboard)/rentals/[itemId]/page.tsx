import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRightIcon, PencilIcon, TruckIcon } from "lucide-react";

import { getRentalItem } from "@/actions/rental.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { RentalDetail } from "../_components/rental-detail";

export const metadata: Metadata = { title: "Rental Item Details" };

// ============================================================
// Rental Item Detail Page
// ============================================================

interface RentalItemDetailPageProps {
  params: Promise<{ itemId: string }>;
}

export default async function RentalItemDetailPage({
  params,
}: RentalItemDetailPageProps) {
  const { itemId } = await params;
  const result = await getRentalItem(itemId);

  if (!result.success || !result.data) {
    notFound();
  }

  const item = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TruckIcon}
        accent="cyan"
        title={item.name}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/rentals" className="transition-colors hover:text-foreground">
              Rentals
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            <span>{item.category}</span>
          </span>
        }
        description={`${item.availableQty} of ${item.quantity} units available`}
      >
        <StatusPill
          label={item.availableQty > 0 ? "Available" : "Fully booked"}
          hue={item.availableQty > 0 ? "emerald" : "amber"}
        />
        <Button variant="outline" asChild>
          <Link href={`/rentals/${item.id}/edit`}>
            <PencilIcon className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      {/* Detail Tabs */}
      <RentalDetail item={item} />
    </div>
  );
}
