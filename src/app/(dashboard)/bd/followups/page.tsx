import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, AlertTriangle, CalendarDays } from "lucide-react";
import { getFollowupQueue } from "@/actions/acq-lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const ring = hue === "rose" ? "text-rose-600" : hue === "amber" ? "text-amber-600" : "text-muted-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className={`size-4 ${ring}`} />
          {title}
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{leads.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
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
    <div className="space-y-5">
      <PageHeader
        title="Follow-ups"
        description="Your active leads by next follow-up date. Overdue first — clear them, log the contact, and the SLA stays green."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Bucket title="Overdue" hue="rose" icon={AlertTriangle} leads={overdue} />
        <Bucket title="Today" hue="amber" icon={CalendarClock} leads={today} />
        <Bucket title="Upcoming" hue="slate" icon={CalendarDays} leads={upcoming} />
      </div>
    </div>
  );
}
