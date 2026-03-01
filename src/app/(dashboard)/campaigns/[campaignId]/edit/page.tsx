import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCampaignById } from "@/actions/campaign.actions";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignForm } from "../../_components/campaign-form";

export const metadata: Metadata = { title: "Edit Campaign" };

// ============================================================
// Edit Campaign Page
// ============================================================

interface EditCampaignPageProps {
  params: Promise<{ campaignId: string }>;
}

export default async function EditCampaignPage({
  params,
}: EditCampaignPageProps) {
  const { campaignId } = await params;
  const result = await getCampaignById(campaignId);

  if (!result.success || !result.data) {
    notFound();
  }

  const campaign = result.data;

  if (campaign.status !== "DRAFT") {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Campaign"
        description={`Editing "${campaign.name}"`}
      />
      <div className="mx-auto max-w-3xl">
        <CampaignForm
          campaign={{
            id: campaign.id,
            name: campaign.name,
            subject: campaign.subject,
            htmlContent: campaign.htmlContent,
            recipientFilter: campaign.recipientFilter as {
              eventType?: string;
              contactType?: string;
            } | null,
            scheduledAt: campaign.scheduledAt,
          }}
        />
      </div>
    </div>
  );
}
