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
  if (pct >= 70) return "bg-success";
  if (pct >= 40) return "bg-warning";
  return "bg-destructive";
}

function scoreTextColor(pct: number): string {
  if (pct >= 70) return "text-success";
  if (pct >= 40) return "text-warning";
  return "text-destructive";
}

export function ScoreBar({
  score,
  max = 100,
  width = 56,
  showValue = true,
  className,
}: ScoreBarProps) {
  if (score === null || score === undefined) {
    return <span className="text-detail text-muted-foreground/60">—</span>;
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
        <span className={cn("text-meta font-medium tabular-nums leading-none", colorText)}>
          {score}
        </span>
      )}
    </div>
  );
}
