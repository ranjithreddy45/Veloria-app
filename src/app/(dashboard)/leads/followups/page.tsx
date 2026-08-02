import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, AlertTriangle, CalendarDays } from "lucide-react";
import { getSalesFollowupQueue } from "@/actions/lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Sales Follow-ups" };
export const dynamic = "force-dynamic";

interface FollowupLead {
  id: string;
  title: string;
  status: string;
  estimatedValue: string | number | null;
  followUpDate: string | null;
  contact?: { firstName: string; lastName: string } | null;
  assignedTo?: { name: string | null } | null;
}

const inr = (n: string | number | null) => (n == null ? "" : "₹" + Math.round(Number(n)).toLocaleString("en-IN"));

function Bucket({ title, hue, icon: Icon, leads }: { title: string; hue: "rose" | "amber" | "slate"; icon: React.ComponentType<{ className?: string }>; leads: FollowupLead[] }) {
  const ring = hue === "rose" ? "text-destructive" : hue === "amber" ? "text-warning" : "text-muted-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className={`size-4 ${ring}`} />
          {title}
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs numeric text-muted-foreground">{leads.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {leads.length === 0 ? (
          <EmptyState
            className="py-8"
            icon={<Icon />}
            title="Nothing in this bucket"
            description="Leads land here as their next follow-up date comes due."
          />
        ) : (
          leads.map((l) => (
            <Link
              key={l.id}
              href={`/leads/${l.id}`}
              className="flex items-start justify-between gap-3 rounded-xl border bg-card px-3.5 py-2.5 text-sm shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="min-w-0">
                <div className="truncate font-medium tracking-[-0.01em]">{l.title}</div>
                <div className="truncate text-body text-muted-foreground">
                  {l.contact ? `${l.contact.firstName} ${l.contact.lastName}` : "—"}
                  {l.estimatedValue ? <> · <span className="numeric">{inr(l.estimatedValue)}</span></> : null}
                  {l.assignedTo?.name ? ` · ${l.assignedTo.name}` : ""}
                </div>
              </div>
              <div className="shrink-0 space-y-1 text-right">
                <StatusPill label={l.status} hue="blue" size="xs" />
                <div className={`numeric text-meta ${hue === "rose" ? "text-destructive" : "text-muted-foreground"}`}>{formatDate(l.followUpDate)}</div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default async function SalesFollowupsPage() {
  const res = await getSalesFollowupQueue();
  const data = res.success ? res.data : { overdue: [], today: [], upcoming: [] };
  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarClock}
        accent="amber"
        eyebrow="Sales · Follow-ups"
        title="Sales Follow-ups"
        description="Your active leads by next follow-up date. Overdue first — clear them and keep the pipeline moving."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Bucket title="Overdue" hue="rose" icon={AlertTriangle} leads={data.overdue as FollowupLead[]} />
        <Bucket title="Today" hue="amber" icon={CalendarClock} leads={data.today as FollowupLead[]} />
        <Bucket title="Upcoming" hue="slate" icon={CalendarDays} leads={data.upcoming as FollowupLead[]} />
      </div>
    </div>
  );
}
