import type { Metadata } from "next";
import { getReviews, getAverageRating } from "@/actions/review.actions";
import { PageHeader } from "@/components/layout/page-header";
import { ReviewsModerationList } from "./_components/reviews-moderation-list";

export const metadata: Metadata = {
  title: "Reviews | Veloria Grand",
};

// ============================================================
// Reviews Moderation Page
// ============================================================

export default async function ReviewsPage() {
  const [reviewsResult, ratingResult] = await Promise.all([
    getReviews(),
    getAverageRating(),
  ]);

  const reviews = reviewsResult.success
    ? reviewsResult.data?.data ?? []
    : [];

  const stats = ratingResult.success
    ? ratingResult.data!
    : { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description="Moderate client reviews and manage public feedback."
      />

      <ReviewsModerationList reviews={reviews} stats={stats} />
    </div>
  );
}
