"use client";

import * as React from "react";
import { StarIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { rateVendor } from "@/actions/vendor.actions";
import { cn } from "@/lib/utils";

// ============================================================
// VendorRating Props
// ============================================================

interface VendorRatingProps {
  vendorId: string;
  currentRating: number;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

// ============================================================
// VendorRating Component
// ============================================================

export function VendorRating({
  vendorId,
  currentRating,
  readonly = false,
  size = "md",
}: VendorRatingProps) {
  const router = useRouter();
  const [hoveredStar, setHoveredStar] = React.useState(0);
  const [isPending, setIsPending] = React.useState(false);

  const sizeClasses = {
    sm: "size-4",
    md: "size-5",
    lg: "size-6",
  };

  const handleRate = async (rating: number) => {
    if (readonly || isPending) return;

    setIsPending(true);
    try {
      const result = await rateVendor(vendorId, rating);
      if (result.success) {
        toast.success(`Rating updated to ${rating} star${rating !== 1 ? "s" : ""}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to update rating");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0.5",
        readonly ? "" : "cursor-pointer",
        isPending && "pointer-events-none opacity-50"
      )}
      onMouseLeave={() => setHoveredStar(0)}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        const isFilled = hoveredStar
          ? starValue <= hoveredStar
          : starValue <= currentRating;

        return (
          <button
            key={i}
            type="button"
            disabled={readonly || isPending}
            className={cn(
              "transition-colors",
              readonly
                ? "cursor-default"
                : "cursor-pointer hover:scale-110 transition-transform"
            )}
            onClick={() => handleRate(starValue)}
            onMouseEnter={() => !readonly && setHoveredStar(starValue)}
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
  );
}
