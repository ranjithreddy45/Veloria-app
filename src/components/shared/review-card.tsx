import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/shared/star-rating";
import { formatDate, cn } from "@/lib/utils";
import { MessageSquare, Calendar, User } from "lucide-react";

// ============================================================
// Review Card Props
// ============================================================

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    title: string | null;
    content: string;
    isPublic: boolean;
    isApproved: boolean;
    response: string | null;
    respondedAt: string | Date | null;
    createdAt: string | Date;
    contact: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string | null;
    };
    booking: {
      id: string;
      bookingNumber: string;
      eventName: string;
      date?: string | Date | null;
    };
  };
  showModeration?: boolean;
  className?: string;
}

// ============================================================
// Review Card Component
// ============================================================

export function ReviewCard({
  review,
  showModeration = false,
  className,
}: ReviewCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-5">
        {/* Header: Rating + Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <StarRating rating={review.rating} size="md" />
            {review.title && (
              <h3 className="text-base font-semibold text-foreground">
                {review.title}
              </h3>
            )}
          </div>
          {showModeration && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {review.isPublic ? (
                <Badge
                  variant="outline"
                  className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400 text-xs"
                >
                  Public
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-xs"
                >
                  Private
                </Badge>
              )}
              {review.isApproved ? (
                <Badge
                  variant="outline"
                  className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-400 text-xs"
                >
                  Approved
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400 text-xs"
                >
                  Pending
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {review.content}
        </p>

        {/* Meta Info */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <User className="size-3" />
            {review.contact.firstName} {review.contact.lastName}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {formatDate(review.createdAt)}
          </span>
          <span className="text-muted-foreground/50">
            {review.booking.eventName} (#{review.booking.bookingNumber})
          </span>
        </div>

        {/* Management Response */}
        {review.response && (
          <div className="mt-4 rounded-lg bg-muted/50 p-3.5 border">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MessageSquare className="size-3" />
              Management Response
              {review.respondedAt && (
                <span className="text-muted-foreground/70">
                  &middot; {formatDate(review.respondedAt)}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-foreground/80">{review.response}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
