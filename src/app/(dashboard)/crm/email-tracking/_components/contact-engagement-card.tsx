"use client";

import Link from "next/link";
import {
  MailIcon,
  EyeIcon,
  MousePointerClickIcon,
  ClockIcon,
} from "lucide-react";

import { Progress } from "@/components/ui/progress";
import type { TopEngagedContact } from "@/schemas/email-tracking.schema";

// ============================================================
// Contact Engagement Card Component
// ============================================================

interface ContactEngagementCardProps {
  contact: TopEngagedContact;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function ContactEngagementCard({ contact }: ContactEngagementCardProps) {
  const openRate =
    contact.totalOpens > 0
      ? Math.min(
          100,
          Math.round((contact.totalOpens / Math.max(contact.totalOpens, 1)) * 100)
        )
      : 0;

  // Engagement score percentage (normalized: max score is capped at 100 for display)
  const engagementPct = Math.min(100, contact.engagementScore * 5);

  return (
    <Link
      href={`/contacts/${contact.contactId}`}
      className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {contact.contactName || "Unknown"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {contact.contactEmail || "--"}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <ClockIcon className="size-3" />
          {timeAgo(contact.lastEngagement)}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1 text-green-600">
          <EyeIcon className="size-3" />
          {contact.totalOpens} opens
        </span>
        <span className="flex items-center gap-1 text-blue-600">
          <MousePointerClickIcon className="size-3" />
          {contact.totalClicks} clicks
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <MailIcon className="size-3" />
          Score: {contact.engagementScore}
        </span>
      </div>

      <div className="mt-2">
        <Progress value={engagementPct} className="h-1.5" />
      </div>
    </Link>
  );
}
