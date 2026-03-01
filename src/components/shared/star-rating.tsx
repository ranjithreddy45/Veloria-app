"use client";

import * as React from "react";
import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { REVIEW_RATING_COLORS } from "@/lib/constants";

// ============================================================
// Star Rating Display Props
// ============================================================

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  className?: string;
}

// ============================================================
// Star Rating Display Component
// ============================================================

export function StarRating({
  rating,
  maxRating = 5,
  size = "md",
  showValue = false,
  interactive = false,
  onRatingChange,
  className,
}: StarRatingProps) {
  const [hoveredStar, setHoveredStar] = React.useState(0);

  const sizeClasses = {
    sm: "size-3.5",
    md: "size-5",
    lg: "size-6",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const colorClass = REVIEW_RATING_COLORS[Math.round(rating)] ?? "text-yellow-500";

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      onMouseLeave={() => interactive && setHoveredStar(0)}
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxRating }).map((_, i) => {
          const starValue = i + 1;
          const isFilled = interactive
            ? hoveredStar
              ? starValue <= hoveredStar
              : starValue <= rating
            : starValue <= rating;

          return (
            <button
              key={i}
              type="button"
              disabled={!interactive}
              className={cn(
                "transition-colors",
                interactive
                  ? "cursor-pointer hover:scale-110 transition-transform"
                  : "cursor-default"
              )}
              onClick={() => interactive && onRatingChange?.(starValue)}
              onMouseEnter={() => interactive && setHoveredStar(starValue)}
            >
              <StarIcon
                className={cn(
                  sizeClasses[size],
                  isFilled
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-muted text-muted-foreground/30"
                )}
              />
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className={cn("font-semibold", textSizeClasses[size], colorClass)}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
