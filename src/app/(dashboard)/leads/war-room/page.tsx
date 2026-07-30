import type { Metadata } from "next";
import { Siren, Timer, AlertTriangle, ShieldAlert, Gauge } from "lucide-react";

import {
  getSlaWarRoomBoard,
  getSlaWarRoomTierConfig,
} from "@/actions/sla-warroom.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { WarRoomBoard } from "./_components/war-room-board";

export const metadata: Metadata = { title: "SLA War-Room" };
export const dynamic = "force-dynamic";

export default async function SlaWarRoomPage() {
  const [boardRes, configRes] = await Promise.all([
    getSlaWarRoomBoard(),
    getSlaWarRoomTierConfig(),
  ]);

  if (!boardRes.success) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={ShieldAlert}
          accent="rose"
          title="SLA War-Room"
          description="Live first-response countdown and tiered breach escalation across every open lead."
        />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {boardRes.error}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { rows, summary, generatedAt } = boardRes.data;
  const warnMinutes = configRes.success ? configRes.data.warnMinutes : 5;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlert}
        accent="rose"
        eyebrow="Sales CRM · Escalation"
        title="SLA War-Room"
        description="Every open lead with a running first-response countdown, a live breach-risk band, and a tiered auto-escalation ladder (rep → manager → admin)."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Pending"
          value={summary.pendingCount}
          accent="blue"
          icon={<Timer />}
          sub="On the clock, comfortably ahead of due"
        />
        <StatTile
          label="At risk"
          value={summary.warnCount}
          accent="amber"
          icon={<AlertTriangle />}
          sub={`Within ${warnMinutes} min of first-contact due`}
        />
        <StatTile
          label="Breached"
          value={summary.breachedCount}
          accent="rose"
          icon={<Siren />}
          sub="Past first-contact deadline, unanswered"
        />
        <StatTile
          label="Escalated to manager"
          value={summary.escalatedManagerCount}
          accent="gold"
          icon={<ShieldAlert />}
          sub={
            summary.avgMinutesToBreach != null
              ? `Avg ${summary.avgMinutesToBreach} min to breach`
              : "Manager-tier escalations open"
          }
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Gauge className="size-3.5" />
        Countdown ticks live in your browser off the server deadline; the cron +
        this board recompute remain the authoritative breach decision.
      </div>

      <WarRoomBoard rows={rows} warnMinutes={warnMinutes} generatedAt={generatedAt} />
    </div>
  );
}
