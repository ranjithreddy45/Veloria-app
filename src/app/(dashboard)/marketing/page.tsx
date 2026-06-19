import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SlidersHorizontalIcon } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";

import {
  getChannelAttribution,
  getCampaignAttribution,
} from "@/actions/attribution-analytics.actions";
import { getMarketingCampaigns } from "@/actions/marketing-campaign.actions";

import { MarketingDashboard } from "./_components/marketing-dashboard";

export const metadata: Metadata = {
  title: "Marketing Attribution",
  description: "Closed-loop CAC, ROAS, win-rate and LTV per channel and campaign",
};

// ============================================================
// Marketing Attribution Cockpit (Server Component)
// ------------------------------------------------------------
// Gated by analytics:read (mirrors analytics/page.tsx). Spend entry lives
// under /marketing/campaigns (marketing:read/manage).
// ============================================================

export default async function MarketingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!hasPermission(session.user.role as string, "analytics:read")) {
    redirect("/not-authorized");
  }

  const [channelRes, campaignRes, campaignsRes] = await Promise.all([
    getChannelAttribution(),
    getCampaignAttribution(),
    getMarketingCampaigns(),
  ]);

  const channels = channelRes.success ? channelRes.data : [];
  const campaigns = campaignRes.success ? campaignRes.data : [];
  const campaignCount = campaignsRes.success ? campaignsRes.data.length : 0;

  const canManage = hasPermission(
    session.user.role as string,
    "marketing:read"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`ATTRIBUTION · ${channels.length} channels · ${campaignCount} campaigns`}
        title="Marketing Attribution"
        help={<PageHelp id="marketing" />}
        description="Closed-loop CAC, ROAS, win-rate and LTV by channel and campaign. Figures are as of the last nightly rollup."
      >
        {canManage && (
          <Button asChild variant="outline">
            <Link href="/marketing/campaigns">
              <SlidersHorizontalIcon className="mr-2 size-4" />
              Campaigns & spend
            </Link>
          </Button>
        )}
      </PageHeader>

      <MarketingDashboard
        initialChannels={channels}
        initialCampaigns={campaigns}
      />
    </div>
  );
}
