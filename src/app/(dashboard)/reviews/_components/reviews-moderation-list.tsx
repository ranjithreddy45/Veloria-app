"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Star,
  Send,
  Hourglass,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { StarRating } from "@/components/shared/star-rating";
import { ReviewCard } from "@/components/shared/review-card";
import { approveReview, respondToReview } from "@/actions/review.actions";
import { formatDate } from "@/lib/utils";
import { REVIEW_RATING_COLORS } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

type ReviewRow = {
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
    email: string | null;
  };
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
    date: string | Date | null;
  };
};

interface ReviewsModerationListProps {
  reviews: ReviewRow[];
  stats: {
    average: number;
    total: number;
    distribution: Record<number, number>;
  };
}

// ============================================================
// Reviews Moderation List
// ============================================================

export function ReviewsModerationList({
  reviews,
  stats,
}: ReviewsModerationListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [respondDialogOpen, setRespondDialogOpen] = React.useState(false);
  const [selectedReview, setSelectedReview] = React.useState<ReviewRow | null>(
    null
  );
  const [responseText, setResponseText] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);

  // Filter reviews by search
  const filterReviews = (list: ReviewRow[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        r.content.toLowerCase().includes(q) ||
        r.contact.firstName.toLowerCase().includes(q) ||
        r.contact.lastName.toLowerCase().includes(q) ||
        r.booking.eventName.toLowerCase().includes(q)
    );
  };

  const pendingReviews = filterReviews(reviews.filter((r) => !r.isApproved));
  const approvedReviews = filterReviews(reviews.filter((r) => r.isApproved));

  // Approve / Reject handler
  const handleApprove = async (id: string, approved: boolean) => {
    setIsPending(true);
    try {
      const result = await approveReview(id, approved);
      if (result.success) {
        toast.success(approved ? "Review approved" : "Review rejected");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to update review");
    } finally {
      setIsPending(false);
    }
  };

  // Respond handler
  const handleRespond = async () => {
    if (!selectedReview || !responseText.trim()) return;
    setIsPending(true);
    try {
      const result = await respondToReview(selectedReview.id, {
        response: responseText,
      });
      if (result.success) {
        toast.success("Response submitted");
        setRespondDialogOpen(false);
        setResponseText("");
        setSelectedReview(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to submit response");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Average Rating"
          value={stats.average ? stats.average.toFixed(1) : "—"}
          accent="amber"
          icon={<Star className="size-4" />}
          sub="out of 5 stars"
        />
        <StatTile
          label="Total Reviews"
          value={stats.total}
          accent="indigo"
          icon={<MessageSquare className="size-4" />}
          sub="all time"
        />
        <StatTile
          label="Pending Moderation"
          value={pendingReviews.length}
          accent="violet"
          icon={<Hourglass className="size-4" />}
          sub="awaiting review"
        />
        <Card className="gap-0 py-0">
          <CardContent className="px-5 py-5">
            <p className="mb-2 text-[13px] font-semibold tracking-[-0.01em] text-foreground">
              Rating Distribution
            </p>
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.distribution[star] ?? 0;
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span
                      className={`w-4 text-right font-medium tabular-nums ${REVIEW_RATING_COLORS[star] ?? ""}`}
                    >
                      {star}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums text-muted-foreground/70">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Input
        placeholder="Search reviews by name, event, or content..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-sm"
      />

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {pendingReviews.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]"
              >
                {pendingReviews.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved
            {approvedReviews.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]"
              >
                {approvedReviews.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-4">
          {pendingReviews.length === 0 ? (
            <Card className="gap-0 py-0">
              <CardContent className="flex flex-col items-center justify-center px-5 py-12 text-center">
                <CheckCircle2 className="size-10 text-emerald-400" />
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  All caught up
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No reviews pending moderation.
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingReviews.map((review) => (
              <div key={review.id} className="space-y-2">
                <ReviewCard review={review} showModeration />
                <div className="flex items-center gap-2 pl-5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                    disabled={isPending}
                    onClick={() => handleApprove(review.id, true)}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
                    disabled={isPending}
                    onClick={() => handleApprove(review.id, false)}
                  >
                    <XCircle className="size-3.5" />
                    Reject
                  </Button>
                  <Dialog
                    open={respondDialogOpen && selectedReview?.id === review.id}
                    onOpenChange={(open) => {
                      setRespondDialogOpen(open);
                      if (!open) {
                        setSelectedReview(null);
                        setResponseText("");
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          setSelectedReview(review);
                          setResponseText(review.response ?? "");
                        }}
                      >
                        <MessageSquare className="size-3.5" />
                        Respond
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Respond to Review</DialogTitle>
                        <DialogDescription>
                          Write a management response to{" "}
                          {review.contact.firstName}&apos;s review.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 py-2">
                        <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground/80">
                          <div className="mb-1 flex items-center gap-2">
                            <StarRating rating={review.rating} size="sm" />
                            <span className="font-medium">
                              {review.contact.firstName}{" "}
                              {review.contact.lastName}
                            </span>
                          </div>
                          <p className="line-clamp-3">{review.content}</p>
                        </div>
                        <Textarea
                          placeholder="Write your response..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          rows={4}
                        />
                      </div>
                      <DialogFooter>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRespondDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={isPending || !responseText.trim()}
                          onClick={handleRespond}
                        >
                          <Send className="size-3.5" />
                          Submit Response
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4 space-y-4">
          {approvedReviews.length === 0 ? (
            <Card className="gap-0 py-0">
              <CardContent className="flex flex-col items-center justify-center px-5 py-12 text-center">
                <Star className="size-10 text-muted-foreground/40" />
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  No approved reviews
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Approved reviews will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            approvedReviews.map((review) => (
              <div key={review.id} className="space-y-2">
                <ReviewCard review={review} showModeration />
                <div className="flex items-center gap-2 pl-5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
                    disabled={isPending}
                    onClick={() => handleApprove(review.id, false)}
                  >
                    <XCircle className="size-3.5" />
                    Revoke Approval
                  </Button>
                  {!review.response && (
                    <Dialog
                      open={
                        respondDialogOpen && selectedReview?.id === review.id
                      }
                      onOpenChange={(open) => {
                        setRespondDialogOpen(open);
                        if (!open) {
                          setSelectedReview(null);
                          setResponseText("");
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => {
                            setSelectedReview(review);
                            setResponseText("");
                          }}
                        >
                          <MessageSquare className="size-3.5" />
                          Respond
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Respond to Review</DialogTitle>
                          <DialogDescription>
                            Write a management response to{" "}
                            {review.contact.firstName}&apos;s review.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground/80">
                            <div className="mb-1 flex items-center gap-2">
                              <StarRating rating={review.rating} size="sm" />
                              <span className="font-medium">
                                {review.contact.firstName}{" "}
                                {review.contact.lastName}
                              </span>
                            </div>
                            <p className="line-clamp-3">{review.content}</p>
                          </div>
                          <Textarea
                            placeholder="Write your response..."
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            rows={4}
                          />
                        </div>
                        <DialogFooter>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRespondDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={isPending || !responseText.trim()}
                            onClick={handleRespond}
                          >
                            <Send className="size-3.5" />
                            Submit Response
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
