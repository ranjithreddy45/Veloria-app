import type { Metadata } from "next";
import { CheckCircle2, Star } from "lucide-react";
import { getReviewRequestByToken } from "@/actions/public-feedback.actions";
import { FeedbackGate } from "./_components/feedback-gate";

// ============================================================
// PUBLIC review-gating landing page — /r/<token> (no auth)
// ------------------------------------------------------------
// Mounted under the (public) route group on the /r prefix (NOT /feedback) so
// middleware INTERNAL_ROUTES never gates the guest page behind login. Resolves
// a ReviewRequest by its unguessable token; shows a 1–5 quick rating gate.
// ============================================================

export const metadata: Metadata = {
  title: "Share your experience — Veloria Grand",
};

export default async function ReviewGatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const req = await getReviewRequestByToken(token);

  // Invalid / unknown token — friendly card, no internal leak.
  if (!req.found) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <p className="text-base font-medium">This link isn’t valid</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The feedback link could not be found or has expired. Please reach out
          to us if you’d still like to share your experience.
        </p>
      </div>
    );
  }

  // Already rated / routed — thank-you state.
  if (req.alreadyRated) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <CheckCircle2 className="size-10 text-emerald-600" />
        <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
          Thank you{req.customerFirstName ? `, ${req.customerFirstName}` : ""}!
        </p>
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          We’ve received your feedback for {req.eventName}. We truly appreciate
          you taking the time.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
          <Star className="size-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          How was {req.eventName}?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {req.customerFirstName ? `Hi ${req.customerFirstName}, ` : ""}thank you
          for celebrating with us at {req.venueName}. Your feedback means the
          world to our team.
        </p>
      </div>

      <FeedbackGate
        token={token}
        customerFirstName={req.customerFirstName}
        eventName={req.eventName}
        googleReviewUrl={req.googleReviewUrl}
      />
    </div>
  );
}
