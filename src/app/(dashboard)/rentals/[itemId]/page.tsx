import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { getRentalItem } from "@/actions/rental.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
            <Badge variant="secondary">{item.category}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {item.availableQty} of {item.quantity} available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/rentals/${item.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Detail Tabs */}
      <RentalDetail item={item} />
    </div>
  );
}
