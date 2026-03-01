import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getRentalItems } from "@/actions/rental.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { RentalItemsTable } from "./_components/rental-items-table";

export const metadata: Metadata = { title: "Equipment Rentals" };

// ============================================================
// Equipment Rentals List Page
// ============================================================

export default async function RentalsPage() {
  const result = await getRentalItems();

  const items = result.success ? result.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment Rentals"
        description="Manage your rental equipment catalog and bookings."
      >
        <Button asChild>
          <Link href="/rentals/new">
            <PlusIcon className="mr-2 size-4" />
            New Rental Item
          </Link>
        </Button>
      </PageHeader>
      <RentalItemsTable data={items} />
    </div>
  );
}
