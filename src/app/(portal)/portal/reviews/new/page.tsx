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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Your account"
        title="Tell us how it went"
        description="Your words help the next couple choose well — and help us get better at what we do."
      />

      {bookings.length === 0 ? (
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
              <CalendarX className="text-muted-foreground/60 size-8" />
            </div>
            <h3 className="font-editorial text-foreground mt-5 text-xl font-semibold">
              Come back after the celebration
            </h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              Once your event wraps up, this is where you can share how it felt.
              We read every word.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="p-6">
            <div className="bg-primary/[0.06] border-primary/15 mb-6 flex items-start gap-3 rounded-xl border p-4">
              <Star className="text-primary mt-0.5 size-4 flex-shrink-0" />
              <p className="text-muted-foreground text-sm leading-relaxed">
                <span className="numeric text-foreground font-semibold">
                  {bookings.length}
                </span>{" "}
                completed event{bookings.length !== 1 ? "s" : ""} ready for your
                thoughts. Be as honest as you like — it&apos;s the only way we
                improve.
              </p>
            </div>
            <ReviewForm bookings={bookings} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
