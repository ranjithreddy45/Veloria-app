import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SEVERITY_LABEL, type AttentionItem, type Severity } from "@/lib/home/attention";
import { formatIstTime } from "@/lib/home/ist";
import { HomeLive } from "./home-live";

// ============================================================
// AttentionFeed — "Needs you now".
//
// Each row offers ONE action and it is a link to the screen where the work is
// done. There is deliberately no "done" or "later" button here: a row leaves
// the list when the record behind it changes, never because someone dismissed
// it, so the list cannot drift away from the truth.
//
// Severity is written out ("Urgent", "Today", "Heads-up") beside the colour
// bar, so it survives greyscale and colour-blindness.
// ============================================================

const BAR: Record<Severity, string> = {
  urgent: "bg-destructive",
  today: "bg-warning",
  "heads-up": "bg-success",
};

export function AttentionFeed({
  items,
  asOf,
  className,
}: {
  items: AttentionItem[];
  asOf: string;
  className?: string;
}) {
  return (
    <Card className={cn("gap-3 p-[18px]", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="home-attention-heading" className="text-lede font-semibold text-foreground">
          Needs you now
        </h2>
        <HomeLive asOf={asOf} label={formatIstTime(asOf)} />
      </div>

      {items.length === 0 ? (
        <p className="text-copy py-6 text-foreground/75">All clear. Nothing is waiting on you.</p>
      ) : (
        <ul aria-labelledby="home-attention-heading" className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="relative flex flex-col gap-3 rounded-[15px] bg-background/60 p-3 transition-colors focus-within:bg-background/90 hover:bg-background/90 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 gap-3">
                <span aria-hidden className={cn("w-1.5 shrink-0 self-stretch rounded-full", BAR[item.severity])} />
                <div className="min-w-0 flex-1">
                  <p className="text-meta font-semibold uppercase tracking-[0.08em] text-foreground/70">
                    {SEVERITY_LABEL[item.severity]}
                  </p>
                  <p className="text-copy font-medium text-foreground [overflow-wrap:anywhere]">{item.title}</p>
                  {item.detail && (
                    <p className="text-body text-foreground/70 [overflow-wrap:anywhere]">{item.detail}</p>
                  )}
                </div>
              </div>
              {/* The link's ::after stretches over the whole row, so the row is
                  one large target while the accessible name stays short and
                  specific: "Respond now: Priya Menon has waited ...". */}
              <Link
                href={item.href}
                aria-label={`${item.actionLabel}: ${item.title}`}
                className="text-body inline-flex min-h-9 shrink-0 items-center justify-center self-start rounded-[11px] bg-primary px-3 py-1.5 font-medium whitespace-nowrap text-primary-foreground after:absolute after:inset-0 after:rounded-[15px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary sm:self-center"
              >
                {item.actionLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
