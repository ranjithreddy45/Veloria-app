import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getMarketingCampaignById } from "@/actions/marketing-campaign.actions";
import { PageHeader } from "@/components/layout/page-header";

import { MarketingCampaignForm } from "../../_components/marketing-campaign-form";

export const metadata: Metadata = { title: "Edit Marketing Campaign" };

// ============================================================
// Edit Marketing Campaign (marketing:manage)
// ============================================================

export default async function EditMarketingCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!hasPermission(session.user.role as string, "marketing:manage")) {
    redirect("/not-authorized");
  }

  const { campaignId } = await params;
  const result = await getMarketingCampaignById(campaignId);
  if (!result.success) {
    notFound();
  }

  const c = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Marketing Campaign"
        description="Update spend, UTM mapping, and campaign settings."
      />
      <div className="mx-auto max-w-3xl">
        <MarketingCampaignForm
          campaign={{
            id: c.id,
            name: c.name,
            channel: c.channel,
            utmSource: c.utmSource,
            utmMedium: c.utmMedium,
            utmCampaign: c.utmCampaign,
            spendToDate: c.spendToDate,
            currency: c.currency,
            startDate: c.startDate,
            endDate: c.endDate,
            isActive: c.isActive,
            notes: c.notes,
          }}
        />
      </div>
    </div>
  );
}
