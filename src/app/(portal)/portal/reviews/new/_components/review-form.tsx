"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, CalendarCheck, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StarRating } from "@/components/shared/star-rating";
import { submitReview } from "@/actions/review.actions";
import { formatDate } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

type CompletedBooking = {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  date: string | Date;
  venueName: string;
};

interface ReviewFormProps {
  bookings: CompletedBooking[];
}

// ============================================================
// Review Form Component
// ============================================================

export function ReviewForm({ bookings }: ReviewFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [selectedBookingId, setSelectedBookingId] = React.useState("");
  const [rating, setRating] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(true);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (rating === 0) {
      setErrors({ rating: ["Please select a rating"] });
      return;
    }

    setIsPending(true);
    try {
      const result = await submitReview({
        bookingId: selectedBookingId,
        rating,
        title: title || undefined,
        content,
        isPublic,
      });

      if (result.success) {
        toast.success("Review submitted successfully! It will be visible after approval.");
        router.push("/portal/bookings");
      } else {
        if (result.details) {
          setErrors(result.details as Record<string, string[]>);
        } else {
          toast.error(result.error);
        }
      }
    } catch {
      toast.error("Failed to submit review");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Booking Selection */}
      <div className="space-y-2">
        <Label htmlFor="booking">Select Booking</Label>
        <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
          <SelectTrigger id="booking">
            <SelectValue placeholder="Choose a completed event..." />
          </SelectTrigger>
          <SelectContent>
            {bookings.map((booking) => (
              <SelectItem key={booking.id} value={booking.id}>
                {booking.eventName} (#{booking.bookingNumber})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.bookingId && (
          <p className="text-sm text-red-500">{errors.bookingId[0]}</p>
        )}
      </div>

      {/* Selected Booking Details */}
      {selectedBooking && (
        <Card className="border-indigo-100 bg-indigo-50/30">
          <CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm text-zinc-600">
            <span className="flex items-center gap-1.5">
              <CalendarCheck className="size-4 text-indigo-500" />
              {formatDate(selectedBooking.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 text-indigo-500" />
              {selectedBooking.venueName}
            </span>
            <span className="text-zinc-400">{selectedBooking.eventType}</span>
          </CardContent>
        </Card>
      )}

      {/* Star Rating */}
      <div className="space-y-2">
        <Label>Rating</Label>
        <StarRating
          rating={rating}
          size="lg"
          interactive
          onRatingChange={setRating}
        />
        {rating > 0 && (
          <p className="text-sm text-zinc-500">
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent"}
          </p>
        )}
        {errors.rating && (
          <p className="text-sm text-red-500">{errors.rating[0]}</p>
        )}
      </div>

      {/* Title (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="title">
          Review Title{" "}
          <span className="font-normal text-zinc-400">(optional)</span>
        </Label>
        <Input
          id="title"
          placeholder="Summarize your experience..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        {errors.title && (
          <p className="text-sm text-red-500">{errors.title[0]}</p>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label htmlFor="content">Your Review</Label>
        <Textarea
          id="content"
          placeholder="Tell us about your experience..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          maxLength={5000}
        />
        <p className="text-xs text-zinc-400">{content.length}/5000 characters</p>
        {errors.content && (
          <p className="text-sm text-red-500">{errors.content[0]}</p>
        )}
      </div>

      {/* Public Toggle */}
      <div className="flex items-center gap-3">
        <Switch
          id="isPublic"
          checked={isPublic}
          onCheckedChange={setIsPublic}
        />
        <Label htmlFor="isPublic" className="font-normal">
          Make this review public (visible on the website after approval)
        </Label>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="gap-2"
        disabled={isPending || !selectedBookingId || rating === 0}
      >
        <Send className="size-4" />
        {isPending ? "Submitting..." : "Submit Review"}
      </Button>
    </form>
  );
}
