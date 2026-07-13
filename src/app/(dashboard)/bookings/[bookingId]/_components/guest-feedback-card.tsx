"use client";

// ============================================================
// Staff-entered guest feedback + rating.
// ------------------------------------------------------------
// A moderator (reviews:moderate) records a guest's post-event feedback on
// their behalf via recordGuestFeedback. If a review already exists it is
// prefilled and updated. Without moderate rights the existing feedback is
// shown read-only (or nothing if none exists).
// ============================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquareHeartIcon, StarIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { recordGuestFeedback } from "@/actions/review.actions";

export interface GuestFeedbackReview {
  id: string;
  rating: number;
  title: string | null;
  content: string;
}

export interface GuestFeedbackCardProps {
  bookingId: string;
  review: GuestFeedbackReview | null;
  canModerate: boolean;
}

function Stars({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={cn(
            "rounded p-0.5",
            !readOnly && "cursor-pointer hover:scale-110 transition-transform"
          )}
        >
          <StarIcon
            className={cn(
              "size-6",
              n <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function GuestFeedbackCard({
  bookingId,
  review,
  canModerate,
}: GuestFeedbackCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [title, setTitle] = useState(review?.title ?? "");
  const [content, setContent] = useState(review?.content ?? "");

  // Read-only view for non-moderators.
  if (!canModerate) {
    if (!review) return null;
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareHeartIcon className="size-4 text-rose-600" />
            Guest Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Stars value={review.rating} readOnly />
          {review.title && <p className="font-medium">{review.title}</p>}
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {review.content}
          </p>
        </CardContent>
      </Card>
    );
  }

  function submit() {
    if (!(rating >= 1 && rating <= 5)) {
      toast.error("Pick a rating from 1 to 5.");
      return;
    }
    if (!content.trim()) {
      toast.error("Feedback text is required.");
      return;
    }
    startTransition(async () => {
      const res = await recordGuestFeedback({
        bookingId,
        rating,
        content: content.trim(),
        title: title.trim() || undefined,
      });
      if (res.success) {
        toast.success(review ? "Feedback updated" : "Feedback recorded");
        router.refresh();
      } else {
        toast.error(res.error || "Something went wrong");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareHeartIcon className="size-4 text-rose-600" />
          Guest Feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Record the guest&apos;s post-event feedback. It enters the review
          moderation queue (unpublished until approved).
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Rating</Label>
          <Stars value={rating} onChange={setRating} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feedback-title" className="text-xs">
            Title <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="feedback-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Wonderful wedding experience"
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feedback-content" className="text-xs">
            Feedback <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="feedback-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What did the guest say about the event?"
            rows={4}
            disabled={isPending}
          />
        </div>
        <Button size="sm" onClick={submit} disabled={isPending}>
          {review ? "Update feedback" : "Save feedback"}
        </Button>
      </CardContent>
    </Card>
  );
}
