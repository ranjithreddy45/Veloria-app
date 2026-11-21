import type { Metadata } from "next";
import { MapPinIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { getPropertyRouting } from "@/actions/property-routing.actions";
import { PropertyRoutingManager } from "./_components/property-routing-manager";

export const metadata: Metadata = { title: "Property Routing" };

// /settings is gated at settings:read by middleware; the save actions check
// settings:update themselves.
export default async function PropertyRoutingPage() {
  const res = await getPropertyRouting();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings · Automation"
        icon={MapPinIcon}
        accent="teal"
        title="Property Routing"
        description="Which property each enquiry is for, and who owns it. Google Ads leads are matched by campaign ID, website leads by the page's property field, Meta leads by the ad set's venue. Leads with no property, and non-corporate leads for a corporate-only property, go to the shared queue."
      />
      {res.success ? (
        <PropertyRoutingManager initial={res.data} />
      ) : (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-body">{res.error}</div>
      )}
    </div>
  );
}
