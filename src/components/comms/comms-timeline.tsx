"use client";

// ============================================================
// CommsTimeline — unified, multi-channel communication feed.
// Renders a normalized CommsTimelineItem[] as a premium vertical
// timeline (channel icon + chip, direction arrow, summary, contact
// name, relative time, status pill).
//
// Reusable: drop <CommsTimeline contactId=... /> onto a contact
// detail page (it fetches its own data), OR pass `items` directly
// (e.g. from a server component that already loaded the feed).
// ============================================================

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Phone,
  Mail,
  MessageSquare,
  MessageCircle,
  CalendarClock,
  StickyNote,
  ArrowDownLeft,
  ArrowUpRight,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import {
  getCommsTimeline,
  type CommsTimelineItem,
  type CommsChannel,
} from "@/actions/communications.actions";

// ------------------------------------------------------------
// Channel → icon + accent color mapping.
// ------------------------------------------------------------
const CHANNEL_META: Record<
  CommsChannel,
  { icon: React.ComponentType<{ className?: string }>; label: string; chip: string; dot: Hue }
> = {
  CALL: {
    icon: Phone,
    label: "Call",
    chip: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300",
    dot: "cyan",
  },
  EMAIL: {
    icon: Mail,
    label: "Email",
    chip: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300",
    dot: "indigo",
  },
  WHATSAPP: {
    icon: MessageCircle,
    label: "WhatsApp",
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
    dot: "emerald",
  },
  SMS: {
    icon: MessageSquare,
    label: "SMS",
    chip: "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300",
    dot: "violet",
  },
  MEETING: {
    icon: CalendarClock,
    label: "Meeting",
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
    dot: "amber",
  },
  NOTE: {
    icon: StickyNote,
    label: "Note",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
    dot: "slate",
  },
};

// Status → pill hue (best-effort across channel-specific statuses).
function statusHue(status: string): Hue {
  const s = status.toUpperCase();
  if (["DELIVERED", "READ", "COMPLETED"].includes(s)) return "emerald";
  if (["SENT", "QUEUED"].includes(s)) return "blue";
  if (["FAILED", "WRONG_NUMBER", "BUSY"].includes(s)) return "red";
  if (["NO_ANSWER", "VOICEMAIL", "CALLBACK_REQUESTED"].includes(s)) return "amber";
  if (["EMAIL_OPEN", "LINK_CLICK"].includes(s)) return "cyan";
  return "neutral";
}

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

// ------------------------------------------------------------
// Single row.
// ------------------------------------------------------------
function TimelineRow({ item, showContact }: { item: CommsTimelineItem; showContact: boolean }) {
  const meta = CHANNEL_META[item.channel] ?? CHANNEL_META.NOTE;
  const Icon = meta.icon;
  const inbound = item.direction === "INBOUND";

  const row = (
    <div className="flex gap-3 py-3">
      <div className="flex flex-col items-center">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", meta.chip)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={meta.label} hue={meta.dot} size="xs" />
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-meta font-medium",
              inbound ? "text-emerald-600" : "text-blue-600"
            )}
            title={inbound ? "Inbound" : "Outbound"}
          >
            {inbound ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
            {inbound ? "In" : "Out"}
          </span>
          {item.status && (
            <StatusPill label={statusLabel(item.status)} hue={statusHue(item.status)} size="xs" />
          )}
          <span className="ml-auto text-meta text-muted-foreground" title={item.at}>
            {relativeTime(item.at)}
          </span>
        </div>
        <p className="mt-1 text-body leading-snug text-foreground">{item.summary}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-meta text-muted-foreground">
          {showContact && item.contactName && (
            <span>
              with <span className="font-medium text-foreground/80">{item.contactName}</span>
            </span>
          )}
          {item.actorName && <span>· by {item.actorName}</span>}
        </div>
      </div>
    </div>
  );

  // Link the whole row to the contact when resolvable.
  if (showContact && item.contactId) {
    return (
      <Link
        href={`/contacts/${item.contactId}`}
        className="block rounded-lg px-2 -mx-2 transition-premium hover:bg-muted/50"
      >
        {row}
      </Link>
    );
  }
  return <div className="px-2 -mx-2">{row}</div>;
}

// ------------------------------------------------------------
// Public component.
// ------------------------------------------------------------
interface CommsTimelineProps {
  /** Scope to a single customer; omit for a global feed. */
  contactId?: string;
  /** Pre-loaded items (skips client fetch). */
  items?: CommsTimelineItem[];
  /** Channel filter (only applies to self-fetch mode). */
  channel?: CommsChannel;
  limit?: number;
  /** Show the contact name / link per row (default: true). */
  showContact?: boolean;
  className?: string;
  emptyHint?: string;
}

export function CommsTimeline({
  contactId,
  items: providedItems,
  channel,
  limit,
  showContact = true,
  className,
  emptyHint = "No communications yet.",
}: CommsTimelineProps) {
  const [items, setItems] = React.useState<CommsTimelineItem[] | null>(
    providedItems ?? null
  );
  const [loading, setLoading] = React.useState(!providedItems);

  React.useEffect(() => {
    if (providedItems) {
      setItems(providedItems);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCommsTimeline({ contactId, channel, limit })
      .then((res) => {
        if (cancelled) return;
        setItems(res.success ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId, channel, limit, providedItems]);

  if (loading) {
    return (
      <div className={cn("space-y-3 py-6 text-center text-sm text-muted-foreground", className)}>
        Loading communications…
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground",
          className
        )}
      >
        <Inbox className="size-7 opacity-40" />
        <p>{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className={cn("divide-y divide-border/60", className)}>
      {items.map((item) => (
        <TimelineRow key={item.id} item={item} showContact={showContact} />
      ))}
    </div>
  );
}
