import type React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ClickUp-style module accent chips — a colored icon tile to the left of the
// title so each module reads at a glance. Full class strings for Tailwind's JIT.
export type HeaderAccent =
  | "brand"
  | "gold"
  | "blue"
  | "amber"
  | "emerald"
  | "teal"
  | "pink"
  | "cyan"
  | "rose"
  | "slate";

// `violet` used to be the brand slot; with an emerald+gold identity it retired and
// gold took its place, so 85 module headers gain the second metal without touching
// their call sites. The remaining hues stay categorical — they let each module read
// at a glance, so they are deliberately NOT collapsed into the brand colour.
const ACCENT_CHIP: Record<HeaderAccent, string> = {
  brand: "bg-primary/12 text-primary dark:bg-primary/20",
  gold: "bg-gold/15 text-gold dark:bg-gold/20",
  blue: "bg-blue-500/12 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300",
  amber: "bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  teal: "bg-teal-500/12 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300",
  pink: "bg-pink-500/12 text-pink-600 dark:bg-pink-400/15 dark:text-pink-300",
  cyan: "bg-cyan-500/12 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300",
  rose: "bg-rose-500/12 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
  slate: "bg-slate-500/12 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300",
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
  aura = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        // min-w-0 on the wrapper AND the text column: without it a long
        // unbroken title (or a wide action button) sets the flex basis and
        // pushes the whole page into a horizontal scroll on a 375px screen.
        "relative flex min-w-0 flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between",
        aura &&
          "bg-aura bg-grid-faint -mx-4 -mt-4 rounded-3xl px-4 pb-5 pt-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon && (
          <span
            className={cn(
              "mt-0.5 hidden size-11 shrink-0 items-center justify-center rounded-2xl shadow-[inset_0_0_0_1px_oklch(1_0_0/0.06)] sm:flex",
              ACCENT_CHIP[accent]
            )}
            aria-hidden
          >
            <Icon className="size-[22px]" strokeWidth={2} />
          </span>
        )}
        <div className="min-w-0 space-y-2">
          {eyebrow && (
            <div className="flex items-center gap-2 text-meta font-semibold uppercase tracking-[0.12em]">
              <span aria-hidden className="from-gold-bright to-gold h-3 w-[3px] rounded-full bg-gradient-to-b" />
              <span className="text-brand-gradient">{eyebrow}</span>
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
