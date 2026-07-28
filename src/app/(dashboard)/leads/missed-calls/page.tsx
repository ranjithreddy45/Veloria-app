import type { Metadata } from "next";
import { PhoneMissed, UserCheck, MessageCircle, Clock } from "lucide-react";

import {
  getMissedCallRescues,
  getMissedCallRescueStats,
} from "@/actions/missed-call-rescue.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { MissedCallsBoard } from "./_components/missed-calls-board";

export const metadata: Metadata = { title: "Missed Calls" };
export const dynamic = "force-dynamic";

export default async function MissedCallsPage() {
  const [listRes, statsRes] = await Promise.all([
    getMissedCallRescues({ page: 1, limit: 50 }),
    getMissedCallRescueStats(),
  ]);

  if (!listRes.success || !statsRes.success) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={PhoneMissed}
          accent="rose"
          eyebrow="Sales CRM · Rescue"
          title="Missed Calls"
          description="Every inbound ring auto-rescued into a tracked lead."
        />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {(!listRes.success && listRes.error) ||
              (!statsRes.success && statsRes.error)}
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = statsRes.data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PhoneMissed}
        accent="rose"
        eyebrow="Sales CRM · Rescue"
        title="Missed Calls"
        description="Every inbound / missed ring from an unknown number is minted into a scored, SLA-clocked lead and answered with an instant WhatsApp. Known callers are linked to their open lead so a human can call back."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Rings rescued"
          value={stats.total}
          accent="blue"
          icon={<PhoneMissed />}
          sub={`${stats.last24h} in the last 24h`}
        />
        <StatTile
          label="New leads minted"
          value={stats.unknownConverted}
          accent="emerald"
          icon={<PhoneMissed />}
          sub="Unknown callers turned into leads"
        />
        <StatTile
          label="Instant WhatsApp sent"
          value={`${stats.whatsappSentRatePct}%`}
          accent="violet"
          icon={<MessageCircle />}
          pct={stats.whatsappSentRatePct}
          sub={`${stats.whatsappSent} auto first-responses landed`}
        />
        <StatTile
          label="Known callers"
          value={stats.knownAck}
          accent="amber"
          icon={<UserCheck />}
          sub="Linked to existing lead — call back"
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="size-3.5" />
        Inbound rings never stamp the speed-to-lead SLA clock — the customer
        called us, so the first-contact deadline keeps running until we respond.
      </div>

      <MissedCallsBoard
        initialRows={listRes.data.rows}
        total={listRes.data.total}
      />
    </div>
  );
}
