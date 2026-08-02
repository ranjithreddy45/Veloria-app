import { Badge } from "@/components/ui/badge";

// ============================================================
// Sentiment Badge
// ============================================================

interface SentimentBadgeProps {
  sentiment?: string | null;
  score?: number | null;
  size?: "sm" | "md";
}

const SENTIMENT_CONFIG: Record<
  string,
  { emoji: string; label: string; className: string }
> = {
  POSITIVE: {
    emoji: "\u{1F60A}",
    label: "Positive",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  NEUTRAL: {
    emoji: "\u{1F610}",
    label: "Neutral",
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  },
  NEGATIVE: {
    emoji: "\u{1F61E}",
    label: "Negative",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

export function SentimentBadge({
  sentiment,
  score,
  size = "sm",
}: SentimentBadgeProps) {
  if (!sentiment) return null;

  const config = SENTIMENT_CONFIG[sentiment];
  if (!config) return null;

  return (
    <Badge variant="outline" className={`gap-1 ${config.className}`}>
      <span>{config.emoji}</span>
      <span className={size === "sm" ? "text-meta" : "text-xs"}>
        {config.label}
      </span>
      {size === "md" && score !== null && score !== undefined && (
        <span className="text-meta opacity-70">
          ({score > 0 ? "+" : ""}
          {score.toFixed(2)})
        </span>
      )}
    </Badge>
  );
}
