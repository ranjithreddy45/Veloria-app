import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Star, CalendarX } from "lucide-react";
import { auth } from "@/../auth";
import { getCompletedBookingsForReview } from "@/actions/review.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewForm } from "./_components/review-form";

export const metadata: Metadata = {
  title: "Write a Review",
};

// ============================================================
// Portal - Submit Review Page
// ============================================================

export default async function PortalNewReviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const result = await getCompletedBookingsForReview();
  const bookings = result.success ? result.data! : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Write a Review"
        description="Share your experience and help us improve our service."
      />

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <CalendarX className="size-8 text-muted-foreground/60" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              No events to review
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              You can only write reviews for completed events. Once your event is
              marked as completed, you will be able to leave feedback here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex items-center gap-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-4">
              <Star className="size-5 text-indigo-600 dark:text-indigo-400" />
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                You have {bookings.length} completed event
                {bookings.length !== 1 ? "s" : ""} available for review. Your
                feedback is valuable and helps us maintain our high standards.
              </p>
            </div>
            <ReviewForm bookings={bookings} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
