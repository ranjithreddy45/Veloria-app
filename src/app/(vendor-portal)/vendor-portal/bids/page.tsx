import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";
import { auth } from "@/../auth";
import { getVendorBids, getAvailableBookingsForBid } from "@/actions/vendor-portal.actions";
import { VendorBidsClient } from "./vendor-bids-client";

export const metadata: Metadata = { title: "My Bids | Vendor Portal" };

// ============================================================
// Vendor Bids Page (Server Component)
// ============================================================

export default async function VendorBidsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const [bidsResult, bookingsResult] = await Promise.all([
    getVendorBids({ page: 1, limit: 20 }),
    getAvailableBookingsForBid(),
  ]);

  if (!bidsResult.success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Gavel className="size-6 text-violet-600" />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            My Bids
          </h1>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-600 dark:text-red-400">
            {bidsResult.error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <VendorBidsClient
      initialData={bidsResult.data}
      availableBookings={bookingsResult.success ? bookingsResult.data : []}
    />
  );
}
