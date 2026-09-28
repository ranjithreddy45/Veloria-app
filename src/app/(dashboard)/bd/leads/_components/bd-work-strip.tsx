import Link from "next/link";
import { AlarmClock, CalendarClock, PhoneMissed, Phone, MapPin, ChevronRight } from "lucide-react";
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
  actionText,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  href?: string;
  tone?: "plain" | "urgent" | "good";
  actionText?: string;
}) {
  const isUrgent = tone === "urgent";
  const isGood = tone === "good";
  
  const toneBg = isUrgent ? "bg-red-500/10" : isGood ? "bg-amber-500/10" : "bg-muted/50";
  const toneBorder = isUrgent ? "border-red-500/20" : isGood ? "border-amber-500/20" : "border-border";
  const toneText = isUrgent ? "text-red-500" : isGood ? "text-amber-500" : "text-blue-400";
  const toneHoverText = isUrgent ? "hover:text-red-400" : isGood ? "hover:text-amber-400" : "hover:text-blue-300";

  const body = (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-start justify-between w-full">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-9 items-center justify-center rounded-lg border", toneBg, toneBorder, toneText)}>
            {icon}
          </span>
          <span className={cn("numeric text-[28px] leading-none font-bold", isUrgent ? "text-red-500" : "text-foreground")}>
            {value}
          </span>
        </div>
        <ChevronRight className={cn("size-4 mt-1 opacity-70", isUrgent ? "text-red-500" : isGood ? "text-amber-500" : "text-muted-foreground")} />
      </div>
      
      <div className="mt-1 flex flex-col gap-2 w-full">
        <span className="block truncate text-[13px] text-muted-foreground">{label}</span>
        {actionText && (
          <span className={cn("text-[11px] font-semibold mt-2 transition-colors", toneText, toneHoverText)}>
            {actionText} <span className="text-sm leading-none ml-0.5">→</span>
          </span>
        )}
      </div>
    </div>
  );

  const shell = "relative flex flex-col surface-glass rounded-xl p-4";
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
        actionText="View now"
      />
      <Stat
        icon={<CalendarClock className="size-4" />}
        label="Due today"
        value={d.dueToday}
        tone={d.dueToday > 0 ? "good" : "plain"}
        href="/bd/leads?view=followup"
        actionText="View leads"
      />
      <Stat
        icon={<PhoneMissed className="size-4" />}
        label="First call overdue"
        value={d.slaBreached}
        tone={d.slaBreached > 0 ? "urgent" : "plain"}
        href="/bd/leads?stage=NEW"
        actionText="Take action"
      />
      <Stat 
        icon={<Phone className="size-4" />} 
        label="Calls logged today" 
        value={d.callsToday} 
        href="/bd/leads"
        actionText="Log a call"
      />
      <Stat
        icon={<MapPin className="size-4" />}
        label="Visits next 7 days"
        value={d.visitsUpcoming}
        href="/bd/leads?view=followup"
        actionText="View schedule"
      />
    </div>
  );
}
