import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wallet, AlertCircle } from "lucide-react";
import { auth } from "@/../auth";
import { getVendorPayouts } from "@/actions/vendor-portal.actions";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { VendorPayoutsClient } from "./vendor-payouts-client";

export const metadata: Metadata = { title: "My Payouts | Vendor Portal" };

// ============================================================
// Vendor Payouts Page (Server Component)
// ============================================================

export default async function VendorPayoutsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const result = await getVendorPayouts({ page: 1, limit: 20 });

  if (!result.success) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Payments"
          icon={Wallet}
          accent="emerald"
          title="Your payouts"
          description="Every advance and settlement we've raised against your work."
        />
        <Card className="rounded-2xl border bg-card shadow-card py-0">
          <CardContent className="p-0">
            <EmptyState
              icon={<AlertCircle />}
              tone="warning"
              title="We couldn't load your payouts"
              description={result.error}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <VendorPayoutsClient initialData={result.data} />;
}
