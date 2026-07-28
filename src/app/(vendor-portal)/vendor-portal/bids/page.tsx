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
          <Gavel className="size-6 text-teal-700 dark:text-teal-300" />
          <h1 className="text-[28px] leading-tight text-foreground">Your bids</h1>
        </div>
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-6">
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
