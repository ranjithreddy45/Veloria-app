"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { submitGuestRating } from "@/actions/guest-host.actions";
import { Card, PrimaryButton } from "../../../_components/ui";

const LABELS = ["", "We are sorry to hear that", "Below expectations", "Good", "Very good", "Exceptional"];
const TAGS = ["Coordinator", "Food", "Decor", "Parking", "Value", "Cleanliness"];

export function RateForm({ bookingId, firstName }: { bookingId: string; firstName: string | null }) {
  const [stars, setStars] = React.useState(0);
  const [tags, setTags] = React.useState<string[]>([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function send() {
    if (!stars) return;
    setBusy(true); setError(null);
    const res = await submitGuestRating(bookingId, stars, tags, text);
    setBusy(false);
    if (!res.success) return setError(res.error);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3.5 px-3 pt-10 text-center">
        <div className="font-editorial text-[28px] font-semibold tracking-[-.015em]">Thank you{firstName ? `, ${firstName}` : ""}.</div>
        <p className="text-body leading-[1.6] text-[#6e6e73]">Your note has reached the team. It is read by the people who ran your day.</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="font-editorial text-[26px] font-medium leading-[1.15] tracking-[-.015em]">How was the evening?</h2>
      <Card className="flex flex-col gap-3.5 rounded-[18px] p-[18px]">
        <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setStars(n)} className={`size-11 text-[32px] leading-none transition-transform active:scale-125 ${n <= stars ? "text-[#b88513]" : "text-[#d1d1d6]"}`}>★</button>
          ))}
        </div>
        <div className="min-h-[18px] text-center text-detail text-[#6e6e73]">{LABELS[stars]}</div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {TAGS.map((t) => { const on = tags.includes(t); return <button key={t} type="button" onClick={() => setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]))} className={`rounded-full border px-3 py-2 text-detail font-medium ${on ? "border-[#6d1b52] bg-[#f7eef2] text-[#6d1b52]" : "border-black/10 bg-white"}`}>{t}</button>; })}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="A line for the team (optional)" className="w-full rounded-xl border border-black/[.08] bg-white px-3.5 py-3 text-body focus:border-[#6d1b52] focus:outline-none" />
      </Card>
      {error && <p className="rounded-xl bg-[#ff3b30]/10 px-3 py-2 text-detail text-[#b3261e]">{error}</p>}
      <PrimaryButton disabled={!stars || busy} onClick={send}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Send"}</PrimaryButton>
    </>
  );
}
