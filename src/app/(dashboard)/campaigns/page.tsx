import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getCampaigns } from "@/actions/campaign.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CampaignTable } from "./_components/campaign-table";

export const metadata: Metadata = { title: "Campaigns" };

// ============================================================
// Campaigns List Page
// ============================================================

export default async function CampaignsPage() {
  const result = await getCampaigns();

  const campaigns = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Create and manage automated email marketing campaigns."
      >
        <Button asChild>
          <Link href="/campaigns/new">
            <PlusIcon className="mr-2 size-4" />
            New Campaign
          </Link>
        </Button>
      </PageHeader>
      <CampaignTable data={campaigns} />
    </div>
  );
}
