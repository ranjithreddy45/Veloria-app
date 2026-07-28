import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Gavel, AlertCircle } from "lucide-react";
import { auth } from "@/../auth";
import { getVendorBids, getAvailableBookingsForBid } from "@/actions/vendor-portal.actions";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
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
      <div className="space-y-6">
        <PageHeader
          eyebrow="Quoting"
          icon={Gavel}
          accent="amber"
          title="Your bids"
          description="What you've quoted us, and where each one stands."
        />
        <Card className="rounded-2xl border bg-card shadow-card py-0">
          <CardContent className="p-0">
            <EmptyState
              icon={<AlertCircle />}
              tone="warning"
              title="We couldn't load your bids"
              description={bidsResult.error}
            />
          </CardContent>
        </Card>
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
