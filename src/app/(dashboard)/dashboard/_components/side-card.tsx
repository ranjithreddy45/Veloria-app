import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatINR } from "@/lib/utils";
import type { SideCard as SideCardData } from "@/lib/home/summary";

// ============================================================
// SideCard — the one supporting picture for the role: money by day this week
// (owner, finance), open leads by status (sales) or today's events (ops,
// staff). Every chart carries its numbers as text too; the bars are a
// reading aid, not the only way to get the figure.
// ============================================================

function Bars({ card }: { card: Extract<SideCardData, { kind: "bars" }> }) {
  const max = Math.max(...card.days.map((d) => d.value), 0);
  return (
    <>
      <p className="numeric text-h2 font-semibold text-foreground">{formatINR(card.total)}</p>
      {max === 0 ? (
        <p className="text-copy py-4 text-foreground/75">Nothing recorded yet this week.</p>
      ) : (
        <ol className="mt-1 flex h-32 items-stretch gap-1.5">
          {card.days.map((d) => (
            <li key={d.name} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="sr-only">
                {d.name}
                {d.isToday ? " (today)" : ""}: {formatINR(d.value)}
              </span>
              <span aria-hidden className="flex w-full flex-1 items-end">
                <span
                  title={`${d.name}: ${formatINR(d.value)}`}
                  className={cn(
                    "block w-full rounded-t-[7px] rounded-b-[3px]",
                    d.isToday ? "bg-gold" : "bg-primary/80"
                  )}
                  // A day with money always shows at least a sliver, so a small
                  // day is not mistaken for an empty one.
                  style={{ height: d.value > 0 ? `${Math.max(4, (d.value / max) * 100)}%` : "0%" }}
                />
              </span>
              <span
                aria-hidden
                className={cn("text-meta", d.isToday ? "font-semibold text-foreground" : "text-foreground/70")}
              >
                {d.label}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function Stages({ card }: { card: Extract<SideCardData, { kind: "stages" }> }) {
  const max = Math.max(...card.rows.map((r) => r.count), 0);
  if (max === 0) return <p className="text-copy py-4 text-foreground/75">No open leads right now.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {card.rows.map((r) => (
        <li key={r.label}>
          <div className="text-body flex justify-between gap-3 text-foreground">
            <span>{r.label}</span>
            <span className="numeric font-semibold">{r.count.toLocaleString("en-IN")}</span>
          </div>
          <div aria-hidden className="mt-1 h-2 overflow-hidden rounded-full bg-foreground/8">
            <div className="h-full rounded-full bg-primary/85" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Events({ card }: { card: Extract<SideCardData, { kind: "events" }> }) {
  if (card.events.length === 0) return null; // the caption already says nothing is on
  return (
    <ul className="flex flex-col gap-2">
      {card.events.map((e) => (
        <li key={e.bookingId}>
          <Link
            href={`/bookings/${e.bookingId}`}
            className="block rounded-[13px] bg-background/60 p-3 transition-colors hover:bg-background/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="text-copy block font-medium text-foreground [overflow-wrap:anywhere]">{e.eventName}</span>
            <span className="text-body block text-foreground/70 [overflow-wrap:anywhere]">
              {e.where} · <span className="numeric">{e.guests.toLocaleString("en-IN")}</span> guests booked
            </span>
            {e.kitchen && <span className="text-body block text-foreground/70">{e.kitchen}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SideCard({ card, className }: { card: SideCardData; className?: string }) {
  return (
    <Card className={cn("gap-3 p-[18px]", className)}>
      <div>
        <h2 className="text-lede font-semibold text-foreground">{card.title}</h2>
        <p className="text-body text-foreground/70">{card.caption}</p>
      </div>
      {card.kind === "bars" && <Bars card={card} />}
      {card.kind === "stages" && <Stages card={card} />}
      {card.kind === "events" && <Events card={card} />}
      <Link
        href={card.href}
        className="text-body mt-auto inline-flex items-center gap-1 self-start rounded-md font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {card.linkLabel}
        <ArrowRight aria-hidden className="size-3.5" />
      </Link>
    </Card>
  );
}
