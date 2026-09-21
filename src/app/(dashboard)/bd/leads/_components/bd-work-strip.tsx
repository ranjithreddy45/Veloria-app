import Link from "next/link";
import { AlarmClock, CalendarClock, PhoneMissed, Phone, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBdWorkStrip } from "@/actions/acq-lead.actions";

// ============================================================
// The BD rep's strip: where they stand, and what to do next — the BD twin of
// the Sales leads WorkStrip. Every urgent counter is a LINK to exactly the
// leads it counted, so nobody hunts for the next call — they land on it.
// Executives see their own book; BD Head / admins see the whole team.
// Server component: no client JS, and it cannot drift from the list because
// its links re-run the very same server-side filters.
// ============================================================

function Stat({
  icon,
  label,
  value,
  href,
  tone = "plain",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  href?: string;
  tone?: "plain" | "urgent" | "good";
}) {
  const body = (
    <>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md",
          tone === "urgent"
            ? "bg-destructive/10 text-destructive"
            : tone === "good"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            "block numeric text-body font-semibold",
            tone === "urgent" ? "text-destructive" : "text-foreground"
          )}
        >
          {value}
        </span>
        <span className="block truncate text-meta text-muted-foreground">{label}</span>
      </span>
    </>
  );

  const shell = "flex items-center gap-2 surface-glass rounded-xl px-3 py-2";
  // Only counters that lead somewhere look clickable — a tile that appears
  // interactive and does nothing teaches people to stop clicking tiles.
  return href ? (
    <Link href={href} className={cn(shell, "transition-colors hover:bg-muted/50")}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

export async function BdWorkStrip() {
  const res = await getBdWorkStrip();
  if (!res.success) return null;
  const d = res.data;

  // Fully clear and nothing logged — a row of zeros would be noise.
  if (
    d.overdue === 0 &&
    d.dueToday === 0 &&
    d.slaBreached === 0 &&
    d.callsToday === 0 &&
    d.visitsUpcoming === 0
  ) {
    return null;
  }

  const who = d.scope === "team" ? "Team" : "My";

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <Stat
        icon={<AlarmClock className="size-4" />}
        label={`${who} follow-ups overdue`}
        value={d.overdue}
        tone={d.overdue > 0 ? "urgent" : "plain"}
        href="/bd/leads?view=followup&due=overdue"
      />
      <Stat
        icon={<CalendarClock className="size-4" />}
        label="Due today"
        value={d.dueToday}
        tone={d.dueToday > 0 ? "good" : "plain"}
        href="/bd/leads?view=followup"
      />
      <Stat
        icon={<PhoneMissed className="size-4" />}
        label="First call overdue"
        value={d.slaBreached}
        tone={d.slaBreached > 0 ? "urgent" : "plain"}
        href="/bd/leads?stage=NEW"
      />
      <Stat icon={<Phone className="size-4" />} label="Calls logged today" value={d.callsToday} />
      <Stat
        icon={<MapPin className="size-4" />}
        label="Visits next 7 days"
        value={d.visitsUpcoming}
      />
    </div>
  );
}
