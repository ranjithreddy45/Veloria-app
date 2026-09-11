"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { requestFromConcierge, submitGuestReferral, type GuestReferral } from "@/actions/guest-host.actions";

// Perks are requests, not self-service redemptions: points are deducted by the
// team when they apply the perk (loyalty:manage), so a host can never spend
// points twice or on something the day cannot deliver.
const PERKS = [
  { id: "valet", title: "Complimentary valet upgrade", sub: "500 points · covers extra cars on event day", cost: 500 },
  { id: "suite", title: "Bridal suite early access", sub: "300 points · from 10 am on event day", cost: 300 },
  { id: "terrace", title: "Terrace cocktail hour", sub: "800 points · 1 hour, subject to availability", cost: 800 },
];

export function Perks({ points, bookingId }: { points: number; bookingId: string | null }) {
  const [done, setDone] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  async function ask(p: (typeof PERKS)[number]) {
    if (!bookingId) return setNote("Hold a date first — perks apply to a booking.");
    setBusy(p.id);
    const res = await requestFromConcierge(bookingId, `Redeem ${p.cost} points: ${p.title}.`, "REDEEM");
    setBusy(null);
    if (!res.success) return setNote(res.error);
    setDone((d) => ({ ...d, [p.id]: true })); setNote("Requested · your coordinator will confirm");
  }

  return (
    <div className="mt-2.5 flex flex-col gap-2">
      {PERKS.map((p) => {
        const applied = done[p.id]; const can = points >= p.cost;
        return (
          <button key={p.id} type="button" disabled={applied || !can || busy === p.id} onClick={() => ask(p)} className={`vg-press flex w-full items-center gap-3.5 rounded-2xl border border-black/[.06] p-4 text-left ${applied ? "bg-[#f0f0f2]" : "bg-white"} ${!applied && !can ? "opacity-55" : ""}`}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#faf3e1]"><span className="size-3.5 rotate-45 rounded-[4px] bg-[#b88513]" /></span>
            <span className="min-w-0 flex-1"><span className="block text-body font-semibold">{p.title}{applied ? " · requested" : ""}</span><span className="block text-meta text-[#6e6e73]">{p.sub}</span></span>
            <span className={`text-detail font-semibold ${applied ? "text-[#2a9d4a]" : can ? "text-[#6d1b52]" : "text-[#6e6e73]"}`}>{busy === p.id ? <Loader2 className="size-4 animate-spin" /> : applied ? "Sent" : can ? "Redeem" : "Not enough"}</span>
          </button>
        );
      })}
      {note && <p className="text-meta text-[#6e6e73]">{note}</p>}
    </div>
  );
}

const REF_STATUS: Record<string, string> = { PENDING: "Received", CONTACTED: "Contacted", LEAD_CREATED: "In conversation", BOOKING_CONFIRMED: "Booked", CONVERTED: "Booked", EXPIRED: "Lapsed", CANCELLED: "Closed" };

export function ReferralForm({ referrals }: { referrals: GuestReferral[] }) {
  const [list, setList] = React.useState(referrals);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const field = "w-full rounded-xl border border-white/25 bg-white/10 px-3.5 py-3 text-body text-[#fdf5f3] placeholder:text-[#fdf5f3]/50 focus:border-[#e8b631] focus:outline-none";

  async function send() {
    setBusy(true); setMsg(null);
    const res = await submitGuestReferral(name, phone);
    setBusy(false);
    if (!res.success) return setMsg(res.error);
    setList((l) => [{ id: res.data.id, name: name.trim(), status: "PENDING", createdAt: new Date().toISOString() }, ...l]);
    setName(""); setPhone(""); setOpen(false); setMsg("Thank you — the team will reach out to them.");
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-[18px] bg-[#6d1b52] p-4 text-[#fdf5f3]">
        <div className="flex items-center gap-3.5">
          <div className="min-w-0 flex-1"><div className="text-body font-semibold">Introduce a friend</div><div className="mt-0.5 text-detail leading-[1.5] text-[#fdf5f3]/75">Give us their name and number; the team takes it from there. Referral rewards are credited when they book.</div></div>
          {!open && <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full bg-[#fdf5f3] px-3.5 py-2 text-detail font-semibold text-[#6d1b52]">Refer</button>}
        </div>
        {open && (
          <div className="vg-rise mt-3 flex flex-col gap-2">
            <input className={field} placeholder="Friend's name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <input className={field} type="tel" inputMode="tel" placeholder="Their mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" onClick={send} disabled={busy} className="flex-1 rounded-xl bg-[#fdf5f3] py-3 text-body font-semibold text-[#6d1b52] disabled:opacity-60">{busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Send introduction"}</button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-white/30 px-4 py-3 text-body font-medium">Cancel</button>
            </div>
          </div>
        )}
        {msg && <p className="mt-2.5 text-detail text-[#f3d489]">{msg}</p>}
      </div>
      {list.length > 0 && (
        <div className="vg-card vg-divide overflow-hidden rounded-2xl">
          {list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1 truncate text-body font-medium">{r.name}</div><span className="rounded-full bg-[#f7eef2] px-2.5 py-1 text-meta font-semibold text-[#6d1b52]">{REF_STATUS[r.status] ?? r.status}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
