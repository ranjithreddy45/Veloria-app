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
      <div className="bg-card shadow-card mx-auto max-w-lg rounded-2xl border p-10 text-center">
        <h1 className="text-foreground text-[24px]">This link isn’t valid</h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          The feedback link couldn’t be found, or it has expired. Do reach out —
          we’d still love to hear how it went.
        </p>
      </div>
    );
  }

  // Already rated / routed — thank-you state.
  if (req.alreadyRated) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/25 bg-success/[0.07] p-10 text-center">
        <CheckCircle2 className="size-9 text-success" />
        <p className="font-editorial mt-2 text-[24px] font-semibold text-success">
          Thank you{req.customerFirstName ? `, ${req.customerFirstName}` : ""}
        </p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-success/85">
          We’ve received your feedback for {req.eventName}, and we truly
          appreciate you taking the time.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card shadow-card rounded-2xl border p-8 sm:p-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-warning/12 text-warning">
          <Star className="size-6" />
        </div>
        <h1 className="text-foreground text-[28px] sm:text-[32px]">
          How was {req.eventName}?
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-[15px] leading-relaxed">
          {req.customerFirstName ? `${req.customerFirstName}, thank you ` : "Thank you "}
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
