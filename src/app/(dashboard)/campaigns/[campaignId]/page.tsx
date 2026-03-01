import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  PencilIcon,
  SendIcon,
  XCircleIcon,
  CalendarIcon,
  ArrowLeftIcon,
} from "lucide-react";

import { getCampaignById } from "@/actions/campaign.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CAMPAIGN_STATUS_COLORS } from "@/lib/constants";
import { CampaignStats } from "../_components/campaign-stats";
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild className="h-auto p-0">
              <Link href="/campaigns">
                <ArrowLeftIcon className="mr-1 size-4" />
                Campaigns
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
          <div className="mt-1 flex items-center gap-3">
            <StatusBadge
              status={campaign.status}
              colorMap={CAMPAIGN_STATUS_COLORS}
            />
            <span className="text-sm text-muted-foreground">
              Created {format(new Date(campaign.createdAt), "dd MMM yyyy")}
            </span>
          </div>
        </div>
        <CampaignActions
          campaignId={campaign.id}
          status={campaign.status}
        />
      </div>

      {/* Stats (only if sent) */}
      {campaign.status === "SENT" && (
        <CampaignStats
          totalSent={campaign.totalSent}
          totalOpened={campaign.totalOpened}
          totalClicked={campaign.totalClicked}
        />
      )}

      {/* Campaign Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground text-xs">Subject Line</p>
              <p className="text-sm font-medium">{campaign.subject}</p>
            </div>
            <Separator />
            <div>
              <p className="text-muted-foreground text-xs">Recipient Filter</p>
              {filter ? (
                <div className="mt-1 space-y-1">
                  {filter.eventType && (
                    <p className="text-sm">
                      Event Type:{" "}
                      <span className="font-medium">{filter.eventType}</span>
                    </p>
                  )}
                  {filter.contactType && (
                    <p className="text-sm">
                      Contact Type:{" "}
                      <span className="font-medium">{filter.contactType}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">All contacts</p>
              )}
            </div>
            <Separator />
            {campaign.scheduledAt && (
              <div>
                <p className="text-muted-foreground text-xs">Scheduled For</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <CalendarIcon className="size-3.5" />
                  {format(new Date(campaign.scheduledAt), "dd MMM yyyy, hh:mm a")}
                </p>
              </div>
            )}
            {campaign.sentAt && (
              <div>
                <p className="text-muted-foreground text-xs">Sent At</p>
                <p className="text-sm font-medium">
                  {format(new Date(campaign.sentAt), "dd MMM yyyy, hh:mm a")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Preview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-white dark:bg-card p-4 max-h-[400px] overflow-auto">
              {/* Sandboxed iframe prevents XSS — no scripts can execute */}
              <iframe
                srcDoc={campaign.htmlContent}
                sandbox=""
                className="w-full min-h-[400px] border-0 rounded-lg"
                title="Campaign Content Preview"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
