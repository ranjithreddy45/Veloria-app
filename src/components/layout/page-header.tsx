import type React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ClickUp-style module accent chips — a colored icon tile to the left of the
// title so each module reads at a glance. Full class strings for Tailwind's JIT.
export type HeaderAccent =
  | "violet"
  | "blue"
  | "amber"
  | "emerald"
  | "teal"
  | "pink"
  | "cyan"
  | "rose"
  | "slate";

const ACCENT_CHIP: Record<HeaderAccent, string> = {
  violet: "bg-violet-500/12 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
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
  description?: string;
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
  accent = "violet",
  children,
  help,
  aura = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between",
        aura &&
          "bg-aura bg-grid-faint -mx-4 -mt-4 rounded-3xl px-4 pb-5 pt-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className
      )}
    >
      <div className="flex items-start gap-3.5">
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
        <div className="space-y-2">
          {eyebrow && (
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
              <span aria-hidden className="h-3 w-[3px] rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-500" />
              <span className="text-brand-gradient">{eyebrow}</span>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <h1 className="large-title text-[28px] leading-tight text-foreground sm:text-[32px]">
              {title}
            </h1>
            {help}
          </div>
          {description && (
            <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children && (
        <div className="relative flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
