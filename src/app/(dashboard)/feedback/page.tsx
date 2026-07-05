import type { Metadata } from "next";
import {
  Clock,
  Send,
  Star,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import {
  getReviewRequestStats,
  getReviewRequests,
} from "@/actions/review-request.actions";
import { FeedbackTable } from "./_components/feedback-table";

export const metadata: Metadata = {
  title: "Feedback",
};

// ============================================================
// INTERNAL feedback dashboard — /feedback (reviews:read)
// ------------------------------------------------------------
// Review-request funnel KPIs + unresolved private feedback with a Resolve
// action. Gated centrally via ROUTE_PERMISSIONS + INTERNAL_ROUTES (sharedEdits).
// ============================================================

export default async function FeedbackPage() {
  const [statsResult, listResult] = await Promise.all([
    getReviewRequestStats(),
    getReviewRequests({ page: 1, limit: 50 }),
  ]);

  const stats = statsResult.success
    ? statsResult.data
    : {
        total: 0,
        byStatus: {
          PENDING: 0,
          SENT: 0,
          RATED: 0,
          ROUTED_PUBLIC: 0,
          ROUTED_PRIVATE: 0,
          COMPLETED: 0,
          FAILED: 0,
          SKIPPED: 0,
        },
        unresolvedPrivate: 0,
      };

  const rows = listResult.success ? listResult.data?.data ?? [] : [];
  const s = stats.byStatus;

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Engagement · Reviews</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{stats.total}</span> review request{stats.total === 1 ? "" : "s"}
            </span>
          </div>
        }
        title="Feedback"
        description="Track the review-request funnel and resolve private feedback before it becomes a public problem."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Pending"
          value={s.PENDING}
          accent="blue"
          icon={<Clock className="size-4" />}
        />
        <StatTile
          label="Sent"
          value={s.SENT}
          accent="cyan"
          icon={<Send className="size-4" />}
        />
        <StatTile
          label="Rated"
          value={s.RATED + s.ROUTED_PUBLIC + s.ROUTED_PRIVATE + s.COMPLETED}
          accent="violet"
          icon={<Star className="size-4" />}
        />
        <StatTile
          label="To Google"
          value={s.ROUTED_PUBLIC + s.COMPLETED}
          accent="emerald"
          icon={<ThumbsUp className="size-4" />}
        />
        <StatTile
          label="Private"
          value={s.ROUTED_PRIVATE}
          accent="amber"
          icon={<ThumbsDown className="size-4" />}
        />
        <StatTile
          label="Failed"
          value={s.FAILED + s.SKIPPED}
          accent="rose"
          icon={<AlertTriangle className="size-4" />}
        />
      </div>

      {stats.unresolvedPrivate > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            <strong>{stats.unresolvedPrivate}</strong> private{" "}
            {stats.unresolvedPrivate === 1 ? "complaint needs" : "complaints need"}{" "}
            attention.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>No unresolved private feedback. Nicely done.</span>
        </div>
      )}

      <FeedbackTable rows={rows} />
    </div>
  );
}
