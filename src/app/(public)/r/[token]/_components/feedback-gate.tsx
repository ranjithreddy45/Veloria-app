"use client";

import { useState, useCallback } from "react";
import {
  Star,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Heart,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  submitGateRating,
  submitPrivateFeedback,
} from "@/actions/public-feedback.actions";

// ============================================================
// PUBLIC feedback gate — client component (no internal data)
// ------------------------------------------------------------
// Step 1: 5-star quick rating → submitGateRating.
//   route PUBLIC (>=4) → thank-you + auto-redirect to Google review URL.
//   route PRIVATE (<4) → reveal private comment box → submitPrivateFeedback.
// ============================================================

interface FeedbackGateProps {
  token: string;
  customerFirstName: string;
  eventName: string;
  googleReviewUrl: string;
}

type Phase = "rate" | "public" | "private" | "done" | "error";

export function FeedbackGate({
  token,
  customerFirstName,
  googleReviewUrl,
}: FeedbackGateProps) {
  const [phase, setPhase] = useState<Phase>("rate");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");

  const submitRating = useCallback(
    async (value: number) => {
      setRating(value);
      setLoading(true);
      setError("");
      try {
        const res = await submitGateRating(token, value);
        if (!res.success) {
          setError(res.error);
          setPhase("error");
          return;
        }
        if (res.route === "PUBLIC") {
          setPhase("public");
          // Happy path → open the Google Business review URL. Degrade to a plain
          // thank-you if no URL is configured.
          if (res.googleReviewUrl) {
            setRedirectUrl(res.googleReviewUrl);
            window.setTimeout(() => {
              window.location.href = res.googleReviewUrl;
            }, 1400);
          }
        } else {
          setPhase("private");
        }
      } catch {
        setError("Something went wrong. Please try again.");
        setPhase("error");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const sendComment = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await submitPrivateFeedback(token, comment);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setPhase("done");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token, comment]);

  // --- PUBLIC (happy) -------------------------------------------------------
  if (phase === "public") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <CheckCircle2 className="size-9 text-emerald-600" />
        <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
          Wonderful — thank you{customerFirstName ? `, ${customerFirstName}` : ""}!
        </p>
        {redirectUrl ? (
          <>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              We’re taking you to Google so you can share the love. It only takes
              a moment.
            </p>
            <Button asChild className="mt-1">
              <a href={redirectUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 size-4" />
                Leave a Google review
              </a>
            </Button>
          </>
        ) : (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            We’re so glad you had a great experience. It was a pleasure hosting
            you!
          </p>
        )}
      </div>
    );
  }

  // --- PRIVATE (unhappy) — capture a private note ---------------------------
  if (phase === "private") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          We’re sorry it wasn’t perfect. Tell us what went wrong — this goes
          straight to our team so we can make it right.
        </div>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="What could we have done better?"
          aria-label="Your feedback"
        />
        {error && (
          <p className="flex items-center gap-1.5 text-sm text-rose-600">
            <AlertCircle className="size-4" /> {error}
          </p>
        )}
        <Button onClick={sendComment} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send feedback"
          )}
        </Button>
      </div>
    );
  }

  // --- DONE (private confirmation) ------------------------------------------
  if (phase === "done") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/40 p-6 text-center">
        <Heart className="size-9 text-rose-500" />
        <p className="text-lg font-semibold">Thank you — we’ll make it right</p>
        <p className="text-sm text-muted-foreground">
          Your feedback has reached our team and someone will follow up. We
          appreciate you giving us the chance to do better.
        </p>
      </div>
    );
  }

  // --- ERROR ----------------------------------------------------------------
  if (phase === "error") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/50 dark:bg-rose-950/30">
        <AlertCircle className="size-9 text-rose-600" />
        <p className="font-semibold text-rose-800 dark:text-rose-200">
          {error || "Something went wrong"}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setPhase("rate");
            setError("");
            setRating(0);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  // --- RATE (step 1) --------------------------------------------------------
  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label="Rate your experience from 1 to 5 stars"
      >
        {[1, 2, 3, 4, 5].map((value) => {
          const active = (hover || rating) >= value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
              disabled={loading}
              onMouseEnter={() => setHover(value)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => setHover(value)}
              onBlur={() => setHover(0)}
              onClick={() => submitRating(value)}
              className="rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed"
            >
              <Star
                className={
                  active
                    ? "size-10 fill-amber-400 text-amber-400"
                    : "size-10 text-zinc-300 dark:text-zinc-600"
                }
              />
            </button>
          );
        })}
      </div>
      {loading ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Saving your rating…
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Tap a star to begin</p>
      )}
    </div>
  );
}
