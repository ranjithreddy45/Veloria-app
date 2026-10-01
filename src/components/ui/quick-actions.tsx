import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Accent } from "@/components/ui/stat-tile";

// The dashboard's quick-action pills, lifted out of full-dashboard-view so
// every module landing can offer the same "what do I do here" row instead of a
// line of identical grey buttons. Filled colour chip + label + one line of
// help, exactly as it renders on the dashboard.
//
// Full class strings per hue — Tailwind's JIT never sees an interpolated one.
const CHIP: Record<Accent, string> = {
  brand: "bg-primary text-primary-foreground shadow-primary/20",
  gold: "bg-gold text-gold-foreground shadow-gold/20",
  blue: "bg-blue-500 text-white shadow-blue-500/20",
  indigo: "bg-indigo-500 text-white shadow-indigo-500/20",
  emerald: "bg-emerald-500 text-white shadow-emerald-500/20",
  amber: "bg-amber-500 text-white shadow-amber-500/20",
  rose: "bg-rose-500 text-white shadow-rose-500/20",
  red: "bg-red-500 text-white shadow-red-500/20",
  pink: "bg-pink-500 text-white shadow-pink-500/20",
  cyan: "bg-cyan-500 text-white shadow-cyan-500/20",
  teal: "bg-teal-500 text-white shadow-teal-500/20",
};

const HOVER_EDGE: Record<Accent, string> = {
  brand: "hover:border-primary/40",
  gold: "hover:border-gold/40",
  blue: "hover:border-blue-500/40",
  indigo: "hover:border-indigo-500/40",
  emerald: "hover:border-emerald-500/40",
  amber: "hover:border-amber-500/40",
  rose: "hover:border-rose-500/40",
  red: "hover:border-red-500/40",
  pink: "hover:border-pink-500/40",
  cyan: "hover:border-cyan-500/40",
  teal: "hover:border-teal-500/40",
};

export interface QuickActionProps {
  href: string;
  icon: LucideIcon;
  label: string;
  /** One short line under the label saying what it does. */
  hint?: string;
  accent?: Accent;
}

export function QuickAction({ href, icon: Icon, label, hint, accent = "brand" }: QuickActionProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs transition-all hover:bg-muted/40 active:scale-95",
        HOVER_EDGE[accent] ?? HOVER_EDGE.brand
      )}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg shadow-md",
          CHIP[accent] ?? CHIP.brand
        )}
        aria-hidden
      >
        <Icon className="size-4" strokeWidth={2.2} />
      </div>
      <div className="flex min-w-0 flex-col text-left">
        <span className="font-semibold leading-tight text-foreground">{label}</span>
        {hint && <span className="text-meta font-normal text-muted-foreground">{hint}</span>}
      </div>
    </Link>
  );
}

/**
 * Horizontal row of quick actions. Scrolls sideways on a narrow screen rather
 * than wrapping into a tall stack that pushes the page content below the fold —
 * the same behaviour as the dashboard header.
 */
export function QuickActions({
  actions,
  className,
}: {
  actions: QuickActionProps[];
  className?: string;
}) {
  if (!actions.length) return null;
  return (
    <div className={cn("flex flex-nowrap items-center gap-2 overflow-x-auto py-1", className)}>
      {actions.map((a) => (
        <QuickAction key={a.href + a.label} {...a} />
      ))}
    </div>
  );
}
