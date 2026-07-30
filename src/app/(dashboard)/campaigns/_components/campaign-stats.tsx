"use client";

import {
  MegaphoneIcon,
  RadioIcon,
  MailIcon,
  EyeIcon,
  MousePointerClickIcon,
} from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";

// ============================================================
// Campaign Stats Props
// ============================================================

interface CampaignStatsProps {
  totalCampaigns: number;
  activeCount: number;
  totalSent: number;
  totalOpened: number;
}

// ============================================================
// CampaignStats — StatTile strip for the Campaigns landing
// ============================================================

export function CampaignStats({
  totalCampaigns,
  activeCount,
  totalSent,
  totalOpened,
}: CampaignStatsProps) {
  const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Total campaigns"
        value={totalCampaigns.toLocaleString("en-IN")}
        accent="indigo"
        icon={<MegaphoneIcon className="size-4" />}
      />
      <StatTile
        label="Active"
        value={activeCount.toLocaleString("en-IN")}
        accent="amber"
        icon={<RadioIcon className="size-4" />}
        sub="Draft, scheduled or sending"
      />
      <StatTile
        label="Reached"
        value={totalSent.toLocaleString("en-IN")}
        accent="blue"
        icon={<MailIcon className="size-4" />}
        sub="Recipients sent across all campaigns"
      />
      <StatTile
        label="Open rate"
        value={`${openRate.toFixed(1)}%`}
        accent="emerald"
        icon={<EyeIcon className="size-4" />}
        pct={openRate}
        sub={`${totalOpened.toLocaleString("en-IN")} opens`}
      />
    </div>
  );
}

// ============================================================
// CampaignPerformance — per-campaign StatTile strip (detail page)
// ============================================================

interface CampaignPerformanceProps {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
}

export function CampaignPerformance({
  totalSent,
  totalOpened,
  totalClicked,
}: CampaignPerformanceProps) {
  const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
  const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Sent"
        value={totalSent.toLocaleString("en-IN")}
        accent="blue"
        icon={<MailIcon className="size-4" />}
      />
      <StatTile
        label="Opened"
        value={totalOpened.toLocaleString("en-IN")}
        accent="emerald"
        icon={<EyeIcon className="size-4" />}
        pct={openRate}
        sub={`${openRate.toFixed(1)}% open rate`}
      />
      <StatTile
        label="Clicked"
        value={totalClicked.toLocaleString("en-IN")}
        accent="gold"
        icon={<MousePointerClickIcon className="size-4" />}
        pct={clickRate}
        sub={`${clickRate.toFixed(1)}% click rate`}
      />
      <StatTile
        label="Click-to-open"
        value={`${
          totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : "0.0"
        }%`}
        accent="amber"
        icon={<MousePointerClickIcon className="size-4" />}
        sub="Clicks per open"
      />
    </div>
  );
}
