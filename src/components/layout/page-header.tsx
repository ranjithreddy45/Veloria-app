import type React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ClickUp-style module accent chips — a colored icon tile to the left of the
// title so each module reads at a glance. Full class strings for Tailwind's JIT.
export type HeaderAccent =
  | "brand"
  | "gold"
  | "blue"
  | "indigo"
  | "amber"
  | "emerald"
  | "teal"
  | "pink"
  | "cyan"
  | "rose"
  | "red"
  | "slate";

// `violet` used to be the brand slot; with an emerald+gold identity it retired and
// gold took its place, so 85 module headers gain the second metal without touching
// their call sites. The remaining hues stay categorical — they let each module read
// at a glance, so they are deliberately NOT collapsed into the brand colour.
// Solid filled chips, matching the dashboard's quick-action tiles (filled
// square, white icon, tinted shadow) — the look Ranjith approved on 2026-09-30.
// Full class strings, never interpolated, because Tailwind's JIT only sees
// literals. `indigo` and `red` are included because 58 pages already pass them.
//
// brand and gold use tokens rather than palette steps: --primary is plum and
// gold is too light for white ink, so each carries its own foreground token.
const ACCENT_CHIP: Record<HeaderAccent, string> = {
  brand: "bg-primary text-primary-foreground shadow-md shadow-primary/25",
  gold: "bg-gold text-gold-foreground shadow-md shadow-gold/25",
  blue: "bg-blue-500 text-white shadow-md shadow-blue-500/25",
  indigo: "bg-indigo-500 text-white shadow-md shadow-indigo-500/25",
  amber: "bg-amber-500 text-white shadow-md shadow-amber-500/25",
  emerald: "bg-emerald-500 text-white shadow-md shadow-emerald-500/25",
  teal: "bg-teal-500 text-white shadow-md shadow-teal-500/25",
  pink: "bg-pink-500 text-white shadow-md shadow-pink-500/25",
  cyan: "bg-cyan-500 text-white shadow-md shadow-cyan-500/25",
  rose: "bg-rose-500 text-white shadow-md shadow-rose-500/25",
  red: "bg-red-500 text-white shadow-md shadow-red-500/25",
  slate: "bg-slate-500 text-white shadow-md shadow-slate-500/25",
};

interface PageHeaderProps {
  title: string;
  /** Supporting copy under the title. ReactNode (not just string) so callers can
   * inline links/emphasis instead of flattening rich content to a template string. */
  description?: React.ReactNode;
  /** Small uppercase label rendered above the title (Linear-style eyebrow). */
  eyebrow?: React.ReactNode;
  /** Optional module icon rendered in a colored chip to the left of the title. */
  icon?: LucideIcon;
  /** Accent hue for the icon chip. Defaults to violet. */
  accent?: HeaderAccent;
  /** Right-side actions. */
  children?: React.ReactNode;
  /** Optional help hint rendered as a "?" next to the title. */
  help?: React.ReactNode;
  /** Render a premium ambient aura + dotted grid behind the header.
   * Use on module landing pages for a hero moment. */
  aura?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  accent = "brand",
  children,
  help,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        // min-w-0 on the wrapper AND the text column: without it a long
        // unbroken title (or a wide action button) sets the flex basis and
        // pushes the whole page into a horizontal scroll on a 375px screen.
        // sm:flex-wrap + a minimum title width: a dense action row (lead detail
        // has nine controls) must wrap BELOW the title, never crush it into
        // letter-by-letter line breaks.
        "relative flex min-w-0 flex-col gap-4 pb-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between",
        // `aura` retained for API compatibility but intentionally no longer
        // paints an ambient glow / dotted grid — Apple restraint keeps the
        // header on the plain canvas.
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5 sm:min-w-[280px] sm:flex-1">
        {/* The module chip. It was disabled during an "Apple restraint" pass
            while 180 pages kept passing `icon`/`accent`, so those props were
            being thrown away — re-rendering it is what carries the dashboard's
            look onto every page that already declared its module colour. */}
        {Icon && (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              ACCENT_CHIP[accent] ?? ACCENT_CHIP.brand
            )}
            aria-hidden
          >
            <Icon className="size-5" strokeWidth={2} />
          </div>
        )}
        <div className="min-w-0 space-y-2">
          {eyebrow && (
            <div className="text-meta font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          {/* The help "?" must not be pushed off-screen by a long title, so the
              title takes the min-w-0/wrap and the hint stays shrink-0. */}
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="large-title min-w-0 break-words text-h2 leading-tight text-foreground sm:text-h1">
              {title}
            </h1>
            {help && <span className="shrink-0">{help}</span>}
          </div>
          {description && (
            <p className="max-w-2xl text-body leading-relaxed text-muted-foreground sm:text-copy">{description}</p>
          )}
        </div>
      </div>
      {children && (
        // Actions wrap AND each child may shrink, so a header with three
        // buttons stacks into rows instead of running off a 375px screen.
        <div className="relative flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">{children}</div>
      )}
    </div>
  );
}
