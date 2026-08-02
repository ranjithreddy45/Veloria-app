// ============================================================
// Site visits booked against this lead. Server component — reads through the
// leads:read-gated action. All times rendered in IST by the action's label
// helpers (formatVisitDateLabel / formatVisitTimeLabel).
// ============================================================

import { MapPinIcon, LinkIcon, UserIcon } from "lucide-react";
import { getLeadSiteVisits } from "@/actions/site-visit.actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { SiteVisitStatus } from "@prisma/client";

const STATUS_STYLE: Record<SiteVisitStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  CONFIRMED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  NO_SHOW: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  RESCHEDULED: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

const STATUS_LABEL: Record<SiteVisitStatus, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
  RESCHEDULED: "Rescheduled",
};

export async function LeadSiteVisits({ leadId }: { leadId: string }) {
  const res = await getLeadSiteVisits(leadId);
  // Insufficient permission / failure → render nothing rather than an error card.
  if (!res.success) return null;
  const visits = res.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Site Visits</CardTitle>
      </CardHeader>
      <CardContent>
        {visits.length === 0 ? (
          <EmptyState
            className="py-8"
            icon={<MapPinIcon />}
            title="No site visits scheduled"
            description="Use “Schedule site visit” to book a showround or tasting — the guest gets their own confirmation link."
          />
        ) : (
          <div className="divide-y">
            {visits.map((v) => (
              <div key={v.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{v.kindLabel}</span>
                    <Badge variant="secondary" className={STATUS_STYLE[v.status]}>
                      {STATUS_LABEL[v.status]}
                    </Badge>
                  </div>
                  <span className="numeric text-meta text-muted-foreground">{v.durationMin} min</span>
                </div>
                <p className="numeric text-sm">
                  {v.dateLabel} · {v.timeLabel} <span className="text-muted-foreground">IST</span>
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-muted-foreground">
                  {v.venueName && (
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="size-3" /> {v.venueName}
                    </span>
                  )}
                  {v.assignedToName && (
                    <span className="flex items-center gap-1">
                      <UserIcon className="size-3" /> {v.assignedToName}
                    </span>
                  )}
                  <a
                    href={`/visit/${v.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground hover:underline"
                  >
                    <LinkIcon className="size-3" /> Guest link
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
