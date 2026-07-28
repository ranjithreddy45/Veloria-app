import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronRightIcon, MegaphoneIcon } from "lucide-react";

import { getCampaignById } from "@/actions/campaign.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CAMPAIGN_STATUS_COLORS } from "@/lib/constants";
import { CampaignPerformance } from "../_components/campaign-stats";
import { CampaignActions } from "./_components/campaign-actions";

export const metadata: Metadata = { title: "Campaign Details" };

// ============================================================
// Campaign Detail Page
// ============================================================

interface CampaignDetailPageProps {
  params: Promise<{ campaignId: string }>;
}

export default async function CampaignDetailPage({
  params,
}: CampaignDetailPageProps) {
  const { campaignId } = await params;
  const result = await getCampaignById(campaignId);

  if (!result.success || !result.data) {
    notFound();
  }

  const campaign = result.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter = campaign.recipientFilter as any;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MegaphoneIcon}
        accent="pink"
        title={campaign.name}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/campaigns" className="transition-colors hover:text-foreground">
              Campaigns
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            <span>Email blast</span>
          </span>
        }
        description={campaign.subject}
      >
        <StatusBadge status={campaign.status} colorMap={CAMPAIGN_STATUS_COLORS} />
        <CampaignActions campaignId={campaign.id} status={campaign.status} />
      </PageHeader>

      {/* Stats (only if sent) */}
      {campaign.status === "SENT" && (
        <CampaignPerformance
          totalSent={campaign.totalSent}
          totalOpened={campaign.totalOpened}
          totalClicked={campaign.totalClicked}
        />
      )}

      {/* Campaign Details */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Setup */}
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Setup</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            How this campaign is addressed and scheduled.
          </p>

          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Subject line
              </dt>
              <dd className="mt-1 text-sm">{campaign.subject}</dd>
            </div>

            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Audience
              </dt>
              <dd className="mt-1 text-sm">
                {filter?.eventType || filter?.contactType ? (
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    {filter.eventType && <span>Event type · {filter.eventType}</span>}
                    {filter.contactType && (
                      <span>Contact type · {filter.contactType}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">All contacts</span>
                )}
              </dd>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Created
                </dt>
                <dd className="numeric mt-1 text-sm">
                  {format(new Date(campaign.createdAt), "dd MMM yyyy")}
                </dd>
              </div>
              {campaign.scheduledAt && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Scheduled for
                  </dt>
                  <dd className="numeric mt-1 text-sm">
                    {format(new Date(campaign.scheduledAt), "dd MMM yyyy, hh:mm a")}
                  </dd>
                </div>
              )}
              {campaign.sentAt && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Sent at
                  </dt>
                  <dd className="numeric mt-1 text-sm">
                    {format(new Date(campaign.sentAt), "dd MMM yyyy, hh:mm a")}
                  </dd>
                </div>
              )}
            </div>
          </dl>
        </section>

        {/* Content Preview */}
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
            Content preview
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Exactly what recipients will see in their inbox.
          </p>
          <div className="bg-card mt-5 max-h-[400px] overflow-auto rounded-xl border p-4">
            {/* Sandboxed iframe prevents XSS — no scripts can execute */}
            <iframe
              srcDoc={campaign.htmlContent}
              sandbox=""
              className="min-h-[400px] w-full rounded-lg border-0"
              title="Campaign Content Preview"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
