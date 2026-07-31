"use client";

import * as React from "react";
import Link from "next/link";
import { MegaphoneIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FacetFilterRail,
  type FacetDef,
} from "@/components/shared/facet-filter-rail";
import { CampaignStats } from "./campaign-stats";
import { CampaignTable, type Campaign } from "./campaign-table";

// ============================================================
// CampaignBoard — client shell: StatTile strip + facet rail + table.
// Data is fetched server-side and passed in; this only handles the
// visual layout and client-side faceting (no data/API changes).
// ============================================================

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  SENDING: "Sending",
  SENT: "Sent",
  CANCELLED: "Cancelled",
};

const ACTIVE_STATUSES = new Set(["DRAFT", "SCHEDULED", "SENDING"]);

const facets: FacetDef<Campaign>[] = [
  {
    key: "status",
    label: "Status",
    get: (c) => c.status,
    format: (v) => STATUS_LABEL[v] ?? v,
  },
  {
    key: "engagement",
    label: "Engagement",
    get: (c) => (c.totalSent > 0 ? "REACHED" : "NOT_SENT"),
    format: (v) => (v === "REACHED" ? "Reached" : "Not yet sent"),
  },
];

interface CampaignBoardProps {
  data: Campaign[];
}

export function CampaignBoard({ data }: CampaignBoardProps) {
  const [filtered, setFiltered] = React.useState<Campaign[]>(data);

  const stats = React.useMemo(() => {
    let activeCount = 0;
    let totalSent = 0;
    let totalOpened = 0;
    for (const c of data) {
      if (ACTIVE_STATUSES.has(c.status)) activeCount += 1;
      totalSent += c.totalSent;
      totalOpened += c.totalOpened;
    }
    return {
      totalCampaigns: data.length,
      activeCount,
      totalSent,
      totalOpened,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card shadow-card">
        <EmptyState
          icon={<MegaphoneIcon className="size-5" />}
          title="No campaigns yet"
          description="Create your first email campaign to start reaching contacts and tracking opens and clicks."
          action={
            <Button asChild>
              <Link href="/campaigns/new">
                <PlusIcon className="mr-2 size-4" />
                New Campaign
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CampaignStats
        totalCampaigns={stats.totalCampaigns}
        activeCount={stats.activeCount}
        totalSent={stats.totalSent}
        totalOpened={stats.totalOpened}
      />
      <div className="flex gap-4">
        <FacetFilterRail
          items={data}
          facets={facets}
          onChange={setFiltered}
        />
        <div className="flex-1 min-w-0">
          <CampaignTable data={filtered} />
        </div>
      </div>
    </div>
  );
}
