import Link from "next/link";
import { Flame, Phone, FileText, Clock, CircleSlash, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSalesWorkStrip } from "@/actions/sales-worklist.actions";

// ============================================================
// The rep's strip: where they stand, and what to do next.
//
// The scoreboard lives on eleven pages under /performance. A rep working their
// list had to leave it to see their standing, so nobody looked and the
// competition did nothing. A scoreboard you navigate to is a report; a
// scoreboard beside the work is an incentive.
//
// Every counter here is a LINK to exactly the leads it counted — not an
// approximation. "3 overdue" is not a number to feel bad about, it is the next
// three calls. That is the answer to "we can't tell which leads to follow":
// you shouldn't hunt for the next call, you should land on it.
//
// Server component: no client JS, no loading flash, and it cannot drift from
// the numbers the leads list itself renders because both read the same filters.
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

  const shell =
    "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2";
  // Only the counters that lead somewhere look clickable. A tile that appears
  // interactive and does nothing teaches people to stop clicking tiles.
  return href ? (
    <Link href={href} className={cn(shell, "transition-colors hover:bg-muted/50")}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

export async function WorkStrip() {
  const res = await getSalesWorkStrip();
  if (!res.success) return null;
  const d = res.data;

  // Nothing earned and nothing outstanding — a brand-new or fully-clear rep.
  // Showing a row of zeros would be noise on their best day.
  if (
    d.todayPoints === 0 &&
    d.callsToday === 0 &&
    d.quotesToday === 0 &&
    d.overdue === 0 &&
    d.untouched === 0 &&
    d.rank === null
  ) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Stat
        icon={<Flame className="size-4" />}
        label="Points today"
        value={d.todayPoints}
        tone={d.todayPoints > 0 ? "good" : "plain"}
      />
      <Stat
        icon={<Trophy className="size-4" />}
        label={
          // "Unranked" is the truth for someone with no ledger rows yet.
          // Printing "#0" or last place would be an invented standing.
          d.rank === null ? "Unranked this month" : `of ${d.teamSize} this month`
        }
        value={d.rank === null ? "—" : `#${d.rank}`}
        href="/performance/leaderboard"
      />
      <Stat
        icon={<Phone className="size-4" />}
        label="Calls logged today"
        value={d.callsToday}
      />
      <Stat
        icon={<FileText className="size-4" />}
        label="Quotes sent today"
        value={d.quotesToday}
      />
      <Stat
        icon={<Clock className="size-4" />}
        label="Follow-ups overdue"
        value={d.overdue}
        tone={d.overdue > 0 ? "urgent" : "plain"}
        href="/leads?due=overdue&sort=cold"
      />
      <Stat
        icon={<CircleSlash className="size-4" />}
        label="Never contacted"
        value={d.untouched}
        tone={d.untouched > 0 ? "urgent" : "plain"}
        href="/leads?due=untouched&sort=cold"
      />
    </div>
  );
}
