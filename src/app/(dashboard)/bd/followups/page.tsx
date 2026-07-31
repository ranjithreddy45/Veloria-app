import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, AlertTriangle, CalendarDays } from "lucide-react";
import { getFollowupQueue } from "@/actions/acq-lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Follow-ups" };
export const dynamic = "force-dynamic";

interface FollowupLead {
  id: string;
  ownerName: string;
  propertyName: string;
  city: string;
  status: string;
  nextFollowupAt: string | null;
  contactAttempts: number;
  bdExecutive?: { name: string | null } | null;
}

function Bucket({
  title,
  hue,
  icon: Icon,
  leads,
}: {
  title: string;
  hue: "rose" | "amber" | "slate";
  icon: React.ComponentType<{ className?: string }>;
  leads: FollowupLead[];
}) {
  const ring = hue === "rose" ? "text-rose-600 dark:text-rose-400" : hue === "amber" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-1.5 px-5 py-5">
        <h2 className="flex items-center gap-2 pb-1.5 text-[13px] font-semibold tracking-[-0.01em] text-foreground">
          <Icon className={`size-4 ${ring}`} />
          {title}
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">{leads.length}</span>
        </h2>
        {leads.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-muted-foreground">Nothing here.</p>
        ) : (
          leads.map((l) => (
            <Link
              key={l.id}
              href={`/bd/leads/${l.id}`}
              className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="font-medium">{l.propertyName}</div>
                <div className="text-xs text-muted-foreground">
                  {l.ownerName} · {l.city}
                  {l.bdExecutive?.name ? ` · ${l.bdExecutive.name}` : ""}
                  {l.contactAttempts > 0 ? ` · ${l.contactAttempts} attempt${l.contactAttempts > 1 ? "s" : ""}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <StatusPill label={l.status} hue={l.status === "NEW" ? "slate" : "blue"} size="xs" />
                <div className={`mt-1 text-[11.5px] ${hue === "rose" ? "text-rose-600" : "text-muted-foreground"}`}>{formatDate(l.nextFollowupAt)}</div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default async function FollowupsPage() {
  const res = await getFollowupQueue();
  const data = res.success ? res.data : { overdue: [], today: [], upcoming: [] };
  const overdue = data.overdue as FollowupLead[];
  const today = data.today as FollowupLead[];
  const upcoming = data.upcoming as FollowupLead[];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Business Development · Acquisition"
        title="Follow-ups"
        description="Your active leads by next follow-up date. Overdue first — clear them, log the contact, and the SLA stays green."
      />

      {/* Queue counts. Three StatTiles across a 375px screen leaves ~66px of
        * usable width inside each (p-5 plus a 32px icon chip), so the labels
        * shred into single-word lines. Two-up on a phone reads cleanly. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Overdue" value={overdue.length} accent="rose" icon={<AlertTriangle className="size-4" />} />
        <StatTile label="Today" value={today.length} accent="amber" icon={<CalendarClock className="size-4" />} />
        <StatTile label="Upcoming" value={upcoming.length} accent="indigo" icon={<CalendarDays className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bucket title="Overdue" hue="rose" icon={AlertTriangle} leads={overdue} />
        <Bucket title="Today" hue="amber" icon={CalendarClock} leads={today} />
        <Bucket title="Upcoming" hue="slate" icon={CalendarDays} leads={upcoming} />
      </div>
    </div>
  );
}
