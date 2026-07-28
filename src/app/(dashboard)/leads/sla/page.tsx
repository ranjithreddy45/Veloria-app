import type { Metadata } from "next";
import { Zap, AlertTriangle, Timer, Gauge, Send } from "lucide-react";

import { getSpeedToLeadDashboard } from "@/actions/speed-to-lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { SlaCockpit } from "./_components/sla-cockpit";

export const metadata: Metadata = { title: "Speed-to-Lead" };
export const dynamic = "force-dynamic";

function formatLatency(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default async function SpeedToLeadPage() {
  const res = await getSpeedToLeadDashboard();

  if (!res.success) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={Gauge}
          accent="amber"
          title="Speed-to-Lead"
          description="Instant automated first-response and first-contact SLA tracking."
        />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {res.error}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, breaches, recent } = res.data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Gauge}
        accent="amber"
        eyebrow="Sales CRM · SLA"
        title="Speed-to-Lead"
        description="Every new lead gets an instant WhatsApp first-response and round-robin assignment. Track the sub-60-second send metric and surface breached first-contact SLAs."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Pending SLA"
          value={summary.pendingSla}
          accent="blue"
          icon={<Timer />}
          sub="Awaiting first response, clock running"
        />
        <StatTile
          label="Breached SLA"
          value={summary.breachedSla}
          accent="rose"
          icon={<AlertTriangle />}
          sub="Past first-contact deadline, unanswered"
        />
        <StatTile
          label="Under 60s"
          value={`${summary.under60sPct}%`}
          accent="emerald"
          icon={<Zap />}
          pct={summary.under60sPct}
          sub="Auto first-responses within the 60s target"
        />
        <StatTile
          label="Avg send latency"
          value={formatLatency(summary.avgLatencyMs)}
          accent="violet"
          icon={<Gauge />}
          sub={`${summary.sentLast24h} sent in last 24h`}
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Send className="size-3.5" />
        Latency measures capture → WhatsApp API accept (the controllable
        target), not message delivery.
      </div>

      <SlaCockpit breaches={breaches} recent={recent} />
    </div>
  );
}
