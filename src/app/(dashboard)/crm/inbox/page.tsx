// ============================================================
// Communications Inbox — unified, multi-channel global feed.
// Merges Communication + CallLog + WhatsApp + SMS + email-tracking
// events into one chronological timeline, with per-channel StatTiles
// and a channel filter. Read-only.
// ============================================================

import {
  getCommsTimeline,
  getCommsStats,
  type CommsChannel,
} from "@/actions/communications.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { CommsTimeline } from "@/components/comms/comms-timeline";
import { ChannelFilter } from "./_components/channel-filter";
import {
  Phone,
  Mail,
  MessageCircle,
  MessageSquare,
  StickyNote,
  Inbox as InboxIcon,
} from "lucide-react";

export const metadata = {
  title: "Communications Inbox",
};

const VALID_CHANNELS: CommsChannel[] = [
  "CALL",
  "EMAIL",
  "WHATSAPP",
  "SMS",
  "NOTE",
  "MEETING",
];

export default async function CommsInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawChannel = (params.channel as string | undefined)?.toUpperCase();
  const channel =
    rawChannel && VALID_CHANNELS.includes(rawChannel as CommsChannel)
      ? (rawChannel as CommsChannel)
      : undefined;

  const [timelineResult, statsResult] = await Promise.all([
    getCommsTimeline({ channel, limit: 100 }),
    getCommsStats(),
  ]);

  const items = timelineResult.success ? timelineResult.data : [];
  const stats = statsResult.success
    ? statsResult.data
    : { call: 0, email: 0, whatsapp: 0, sms: 0, note: 0, meeting: 0, total: 0 };

  const denied =
    !timelineResult.success &&
    timelineResult.error === "Insufficient permissions";

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Engagement · CRM</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{stats.total}</span> touchpoint{stats.total === 1 ? "" : "s"} this month
            </span>
          </div>
        }
        title="Communications Inbox"
        description="Every customer touchpoint — calls, emails, WhatsApp, SMS and notes — in one chronological feed."
      />

      {denied ? (
        <Card className="gap-0 py-0">
          <CardContent className="px-5 py-12 text-center text-sm text-muted-foreground">
            You don&apos;t have permission to view communications.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile
              label="Total"
              value={stats.total}
              accent="indigo"
              icon={<InboxIcon className="size-4" />}
              sub="this month"
            />
            <StatTile
              label="Calls"
              value={stats.call}
              accent="cyan"
              icon={<Phone className="size-4" />}
              sub="this month"
            />
            <StatTile
              label="Emails"
              value={stats.email}
              accent="indigo"
              icon={<Mail className="size-4" />}
              sub="this month"
            />
            <StatTile
              label="WhatsApp"
              value={stats.whatsapp}
              accent="emerald"
              icon={<MessageCircle className="size-4" />}
              sub="this month"
            />
            <StatTile
              label="SMS"
              value={stats.sms}
              accent="gold"
              icon={<MessageSquare className="size-4" />}
              sub="this month"
            />
            <StatTile
              label="Notes"
              value={stats.note}
              accent="amber"
              icon={<StickyNote className="size-4" />}
              sub="this month"
            />
          </div>

          <Card className="gap-0 py-0">
            <CardContent className="px-5 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-body font-semibold tracking-[-0.01em]">Recent activity</h2>
                <ChannelFilter active={channel ?? ""} />
              </div>
              <div className="mt-4">
                <CommsTimeline items={items} showContact emptyHint="No communications match this filter." />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
