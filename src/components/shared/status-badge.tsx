import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================================
// StatusBadge Props
// ============================================================

interface StatusBadgeProps {
  status: string;
  colorMap: Record<string, string>;
  label?: string;
  className?: string;
}

// ============================================================
// StatusBadge Component
// ============================================================

export function StatusBadge({
  status,
  colorMap,
  label,
  className,
}: StatusBadgeProps) {
  const colorClasses =
    colorMap[status] ?? "bg-muted text-foreground border-border";

  const displayLabel =
    label ??
    status
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  // Extract the text color to use for the dot indicator
  const dotColorMatch = colorClasses.match(/text-(\S+)/);
  const dotColor = dotColorMatch
    ? `bg-${dotColorMatch[1].replace("text-", "")}`
    : "bg-current";

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border font-medium", colorClasses, className)}
    >
      <span
        className={cn("inline-block size-1.5 rounded-full bg-current opacity-70")}
        aria-hidden
      />
      {displayLabel}
    </Badge>
  );
}
