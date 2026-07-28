import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarCheck, AlertCircle } from "lucide-react";
import { auth } from "@/../auth";
import { getVendorEvents } from "@/actions/vendor-portal.actions";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { VendorEventsClient } from "./vendor-events-client";

export const metadata: Metadata = { title: "My Events | Vendor Portal" };

// ============================================================
// Vendor Events Page (Server Component)
// ============================================================

export default async function VendorEventsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const result = await getVendorEvents({ page: 1, limit: 20 });

  if (!result.success) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Schedule"
          icon={CalendarCheck}
          accent="teal"
          title="Your events"
          description="Every date our clients are counting on you for."
        />
        <Card className="rounded-2xl border bg-card shadow-card py-0">
          <CardContent className="p-0">
            <EmptyState
              icon={<AlertCircle />}
              tone="warning"
              title="We couldn't load your schedule"
              description={result.error}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <VendorEventsClient initialData={result.data} />;
}
