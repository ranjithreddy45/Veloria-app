import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getMarketingCampaigns } from "@/actions/marketing-campaign.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

import { MarketingCampaignTable } from "./_components/marketing-campaign-table";

export const metadata: Metadata = { title: "Marketing Campaigns" };

// ============================================================
// Marketing Campaigns List (spend ledger for CAC / ROAS)
// Gated marketing:read.
// ============================================================

export default async function MarketingCampaignsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!hasPermission(session.user.role as string, "marketing:read")) {
    redirect("/not-authorized");
  }

  const result = await getMarketingCampaigns();
  const campaigns = result.success ? result.data : [];

  const canManage = hasPermission(
    session.user.role as string,
    "marketing:manage"
  );

  const active = campaigns.filter((c) => c.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`MARKETING · ${campaigns.length} campaigns · ${active} active`}
        title="Marketing Campaigns"
        description="Track ad spend per channel/campaign so the attribution cockpit can compute CAC and ROAS. One campaign should own a given utm_campaign string."
      >
        {canManage && (
          <Button asChild>
            <Link href="/marketing/campaigns/new">
              <PlusIcon className="mr-2 size-4" />
              New Campaign
            </Link>
          </Button>
        )}
      </PageHeader>

      <MarketingCampaignTable data={campaigns} canManage={canManage} />
    </div>
  );
}
