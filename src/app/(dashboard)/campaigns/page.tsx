import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getCampaigns } from "@/actions/campaign.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { CampaignBoard } from "./_components/campaign-board";

export const metadata: Metadata = { title: "Campaigns" };

const ACTIVE_STATUSES = new Set(["DRAFT", "SCHEDULED", "SENDING"]);

// ============================================================
// Campaigns List Page
// ============================================================

export default async function CampaignsPage() {
  const result = await getCampaigns();

  const campaigns = result.success ? result.data : [];

  const total = campaigns.length;
  const active = campaigns.filter((c) => ACTIVE_STATUSES.has(c.status)).length;
  const eyebrow = `MARKETING · ${total} ${
    total === 1 ? "campaign" : "campaigns"
  } · ${active} active`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title="Campaigns"
        help={<PageHelp id="campaigns" />}
        description="Create and manage automated email marketing campaigns."
      >
        <Button asChild>
          <Link href="/campaigns/new">
            <PlusIcon className="mr-2 size-4" />
            New Campaign
          </Link>
        </Button>
      </PageHeader>
      <CampaignBoard data={campaigns} />
    </div>
  );
}
