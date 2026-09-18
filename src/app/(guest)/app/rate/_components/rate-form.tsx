"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { GuestResult } from "@/actions/guest-account.actions";
import { Card, PrimaryButton } from "../../../_components/ui";
import { RATING_TAGS } from "../_lib/eligibility";

const LABELS = ["", "We are sorry to hear that", "Below expectations", "Good", "Very good", "Exceptional"];

type ReviewAction = (input: { bookingId: string; rating: number; tags: string[]; text: string; isPublic: boolean }) => Promise<GuestResult<{ id: string }>>;

export function RateForm({ bookingId, disabled, action }: { bookingId: string; disabled: boolean; action: ReviewAction }) {
  const router = useRouter();
  const [stars, setStars] = React.useState(0);
  const [tags, setTags] = React.useState<string[]>([]);
  const [text, setText] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function send() {
    if (!stars || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const res = await action({ bookingId, rating: stars, tags, text, isPublic });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSent(true);
      // The server page then shows the review and where it stands with the team.
      router.refresh();
    } catch {
      setError("Couldn't send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return <p className="px-3 pt-6 text-center text-body leading-[1.6] text-[#6e6e73]">Thank you. Your review has reached the team.</p>;
  }

  return (
    <>
      <h2 className="font-editorial text-[26px] font-medium leading-[1.15] tracking-[-.015em]">How was the evening?</h2>
      <Card className="flex flex-col gap-3.5 rounded-[18px] p-[18px]">
        <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setStars(n)}
              disabled={disabled}
              className={`size-11 text-[32px] leading-none transition-transform active:scale-125 ${n <= stars ? "text-[#b88513]" : "text-[#d1d1d6]"}`}
            >
              ★
            </button>
          ))}
        </div>
        <div className="min-h-[18px] text-center text-detail text-[#6e6e73]">{LABELS[stars]}</div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {RATING_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]))}
                className={`rounded-full border px-3 py-2 text-detail font-medium ${on ? "border-[#6d1b52] bg-[#f7eef2] text-[#6d1b52]" : "border-black/10 bg-white"}`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          disabled={disabled}
          placeholder="A line for the team (optional)"
          aria-label="A line for the team"
          className="w-full rounded-xl border border-black/[.08] bg-white px-3.5 py-3 text-body focus:border-[#6d1b52] focus:outline-none"
        />
        <label className="flex items-start gap-2.5 text-detail leading-[1.5] text-[#1d1d1f]">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} disabled={disabled} className="mt-0.5 size-4 accent-[#6d1b52]" />
          <span>Show this review on our hall pages once the team approves it</span>
        </label>
      </Card>
      {error && <p className="rounded-xl bg-[#ff3b30]/10 px-3 py-2 text-detail text-[#b3261e]">{error}</p>}
      <PrimaryButton disabled={!stars || busy || disabled} onClick={send}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Send"}
      </PrimaryButton>
    </>
  );
}
