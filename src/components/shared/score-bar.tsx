import { cn } from "@/lib/utils";

// ============================================================
// ScoreBar — horizontal mini progress bar
// ----------------------------------------------------------------
// 0..100 scale, color shifts red → amber → green.
// Use for lead score, fit score, deal probability, etc.
// ============================================================

interface ScoreBarProps {
  score: number | null | undefined;
  /** Range max for normalization. Default 100. */
  max?: number;
  /** Compact width — useful inside tight table cells. */
  width?: number;
  showValue?: boolean;
  className?: string;
}

function scoreColor(pct: number): string {
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function scoreTextColor(pct: number): string {
  if (pct >= 70) return "text-emerald-700 dark:text-emerald-400";
  if (pct >= 40) return "text-amber-700 dark:text-amber-400";
  return "text-rose-700 dark:text-rose-400";
}

export function ScoreBar({
  score,
  max = 100,
  width = 56,
  showValue = true,
  className,
}: ScoreBarProps) {
  if (score === null || score === undefined) {
    return <span className="text-[12px] text-muted-foreground/60">—</span>;
  }
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  const colorBg = scoreColor(pct);
  const colorText = scoreTextColor(pct);

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div
        className="relative h-1 rounded-full bg-muted overflow-hidden"
        style={{ width }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={score}
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all", colorBg)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue && (
        <span className={cn("text-[11.5px] font-medium tabular-nums leading-none", colorText)}>
          {score}
        </span>
      )}
    </div>
  );
}
