"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUp, Loader2, MessageCircle, Phone } from "lucide-react";
import { requestFromConcierge, type GuestRequest } from "@/actions/guest-host.actions";

// ============================================================
// Concierge — a request line to the host's coordinator.
//
// There is no live chat backend for customers, and the screen does not
// pretend there is: each message becomes a task in the coordinator's queue
// and is shown here as sent, with its status. Replies come by phone or
// WhatsApp, which the header offers directly when a public number exists.
// ============================================================

const QUICK = ["Add 40 chairs", "Parking passes", "Change menu tasting", "Bridal room access"];

export function ConciergeChat({ bookingId, eventName, coordinator, initial, firstName, whatsapp, phone }: {
  bookingId: string | null; eventName: string | null; coordinator: { initials: string; name: string; role: string } | null;
  initial: GuestRequest[]; firstName: string | null; whatsapp: string | null; phone: string | null;
}) {
  const [items, setItems] = React.useState(initial);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [items.length]);

  async function send(msg: string) {
    const clean = msg.trim(); if (!clean || !bookingId || busy) return;
    setBusy(true); setError(null);
    const res = await requestFromConcierge(bookingId, clean, "MESSAGE");
    setBusy(false);
    if (!res.success) return setError(res.error);
    setItems((x) => [...x, { id: res.data.id, text: clean, kind: "MESSAGE", createdAt: new Date().toISOString(), status: "TODO" }]);
    setText("");
  }

  const waHref = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hi, this is ${firstName ?? "a host"}${eventName ? ` (${eventName})` : ""}.`)}` : null;
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
  const statusWord = (s: string) => (s === "DONE" ? "Done" : s === "IN_PROGRESS" ? "In hand" : "Received");

  return (
    <div className="vg-rise flex min-h-[calc(100vh-6rem-var(--sab))] flex-col gap-4 px-5 pt-[calc(var(--sat)+1rem)]">
      <div className="flex items-center gap-3">
        <span className="relative flex size-[46px] shrink-0 items-center justify-center rounded-full bg-[#f7eef2] text-detail font-semibold text-[#6d1b52]">
          {coordinator?.initials ?? "VG"}
          <span className="absolute bottom-px right-px size-[11px] rounded-full border-2 border-[#f3f0ec] bg-[#34c759]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-editorial text-[22px] font-semibold leading-[1.1] tracking-[-.01em]">Concierge</div>
          <div className="mt-0.5 truncate text-meta text-[#6e6e73]">{coordinator ? `${coordinator.name} · ${coordinator.role.toLowerCase()}` : "Veloria events team"} · replies by phone or WhatsApp</div>
        </div>
        {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp us" className="flex size-10 items-center justify-center rounded-full bg-[#e6f6ea] text-[#2a9d4a]"><MessageCircle className="size-5" /></a>}
        {telHref && <a href={telHref} aria-label="Call us" className="flex size-10 items-center justify-center rounded-full bg-white text-[#1d1d1f] ring-1 ring-black/[.07]"><Phone className="size-4.5" /></a>}
      </div>

      {!bookingId ? (
        <div className="vg-card rounded-2xl p-4 text-detail leading-[1.55] text-[#3a3a3c]">
          <span className="font-semibold text-[#1d1d1f]">No booking is linked to this account yet.</span> Once you hold a date, requests here go straight to your coordinator. Until then, {waHref ? <a href={waHref} className="font-semibold text-[#6d1b52]" target="_blank" rel="noopener noreferrer">WhatsApp us</a> : <Link href="/app/book/enquire" className="font-semibold text-[#6d1b52]">request a callback</Link>}.
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2">
          <div className="self-start max-w-[78%] rounded-[18px] rounded-bl-md bg-white px-3.5 py-2.5 text-body leading-[1.45] shadow-[0_1px_2px_rgba(0,0,0,.04)]">
            {firstName ? `Good day, ${firstName}. ` : ""}How may we assist you{eventName ? ` with ${eventName}` : ""}? Anything you send here reaches your coordinator&apos;s task list immediately.
          </div>
          {items.map((m) => (
            <div key={m.id} className="flex flex-col items-end gap-1">
              <div className="max-w-[78%] rounded-[18px] rounded-br-md bg-[#6d1b52] px-3.5 py-2.5 text-body leading-[1.45] text-[#fdf5f3]">{m.text}</div>
              <div className="text-[10.5px] text-[#8a8a8e]">{statusWord(m.status)} · {new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {bookingId && (
        <div className="vg-glass fixed inset-x-0 bottom-[calc(var(--sab)+66px)] z-30 mx-auto flex max-w-md flex-col gap-2.5 px-5 pb-3 pt-3">
          <div className="vg-scroll-x vg-bleed gap-1.5">
            {QUICK.map((q) => <button key={q} type="button" onClick={() => send(q)} disabled={busy} className="shrink-0 rounded-full border border-black/[.08] bg-white px-3.5 py-2 text-detail font-medium disabled:opacity-60">{q}</button>)}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-black/[.08] bg-white py-1.5 pl-4 pr-1.5">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(text)} placeholder="How may we assist you?" className="min-h-8 min-w-0 flex-1 bg-transparent text-body focus:outline-none" />
            <button type="button" aria-label="Send" onClick={() => send(text)} disabled={busy || !text.trim()} className="flex size-9 items-center justify-center rounded-full bg-[#6d1b52] text-[#fdf5f3] disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}</button>
          </div>
          {error && <p className="text-meta text-[#b3261e]">{error}</p>}
        </div>
      )}
      {bookingId && <div className="h-28" />}
    </div>
  );
}
