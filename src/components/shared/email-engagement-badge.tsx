"use client";

import * as React from "react";
import { EyeIcon, MousePointerClickIcon, Loader2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getTrackingForCommunication } from "@/actions/email-tracking.actions";

// ============================================================
// Email Engagement Badge
// ============================================================
// Reusable badge for communication timelines. Shows "Opened"
// (green) or "Clicked" (blue) with event counts.

interface EmailEngagementBadgeProps {
  communicationId: string;
  compact?: boolean;
}

interface TrackingData {
  opens: number;
  clicks: number;
}

export function EmailEngagementBadge({
  communicationId,
  compact = false,
}: EmailEngagementBadgeProps) {
  const [data, setData] = React.useState<TrackingData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    getTrackingForCommunication(communicationId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        const events = res.data.events || [];
        const opens = events.filter(
          (e: { type: string }) => e.type === "EMAIL_OPEN"
        ).length;
        const clicks = events.filter(
          (e: { type: string }) => e.type === "LINK_CLICK"
        ).length;
        setData({ opens, clicks });
      } else {
        setData(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [communicationId]);

  if (loading) {
    if (compact) return null;
    return (
      <Loader2Icon className="size-3 animate-spin text-muted-foreground" />
    );
  }

  if (!data || (data.opens === 0 && data.clicks === 0)) {
    return null;
  }

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {data.opens > 0 && (
          <Badge
            variant="secondary"
            className="bg-green-50 text-green-700 border-green-200 px-1.5 py-0 text-[10px]"
          >
            <EyeIcon className="mr-0.5 size-2.5" />
            {data.opens}
          </Badge>
        )}
        {data.clicks > 0 && (
          <Badge
            variant="secondary"
            className="bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0 text-[10px]"
          >
            <MousePointerClickIcon className="mr-0.5 size-2.5" />
            {data.clicks}
          </Badge>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {data.opens > 0 && (
        <Badge
          variant="secondary"
          className="bg-green-50 text-green-700 border-green-200"
        >
          <EyeIcon className="mr-1 size-3" />
          Opened ({data.opens})
        </Badge>
      )}
      {data.clicks > 0 && (
        <Badge
          variant="secondary"
          className="bg-blue-50 text-blue-700 border-blue-200"
        >
          <MousePointerClickIcon className="mr-1 size-3" />
          Clicked ({data.clicks})
        </Badge>
      )}
    </span>
  );
}
