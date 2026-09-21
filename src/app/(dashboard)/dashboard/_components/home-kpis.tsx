import Link from "next/link";
import { ArrowUpRight, CircleAlert, CircleCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { HomeKpi } from "@/lib/home/summary";

// ============================================================
// HomeKpis — up to four figures chosen for the role.
//
// Each tile is a link to the screen that owns its number, so anyone who
// doubts a figure is one click from the rows behind it. Fewer than four tiles
// is normal: a tile is left out when the role may not see its module.
//
// Tone is carried by an icon plus the words of the sub line. The sub line's
// TEXT stays in the ink colour: the brand's success and warning hues fall
// well short of 4.5:1 at this size on a glass surface.
// ============================================================

export function HomeKpis({ kpis }: { kpis: HomeKpi[] }) {
  if (kpis.length === 0) return null;
  return (
    <section aria-labelledby="home-kpis-heading">
      <h2 id="home-kpis-heading" className="sr-only">
        Key figures
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <li key={k.id} className="min-w-0">
            <Link
              href={k.href}
              className="group block h-full rounded-[22px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Card className="surface-lift h-full gap-1 p-[18px]">
                <span className="text-meta flex items-start justify-between gap-2 font-medium uppercase tracking-[0.08em] text-foreground/70">
                  {k.label}
                  <ArrowUpRight
                    aria-hidden
                    className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70"
                  />
                </span>
                <span className="numeric text-h2 xl:text-h1 block font-semibold text-foreground">{k.value}</span>
                <span className="text-body flex items-start gap-1.5 text-foreground/75">
                  {k.tone === "bad" && <CircleAlert aria-hidden className="mt-[3px] size-3.5 shrink-0 text-destructive" />}
                  {k.tone === "good" && <CircleCheck aria-hidden className="mt-[3px] size-3.5 shrink-0 text-success" />}
                  {k.sub}
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
