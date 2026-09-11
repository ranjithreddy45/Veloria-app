"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { addGuestQuick, type GuestListRow } from "@/actions/guest-host.actions";
import { portalSetGuestRsvp, portalSendInvitation, portalBulkSendInvitations } from "@/actions/portal-guest.actions";
import { ScreenHeader, Card, Chip, Avatar, initialsTone } from "./guest-ui";

type Stats = { confirmed: number; declined: number; pending: number; total: number; families: number };
const ST: Record<GuestListRow["rsvpStatus"], { label: string; cls: string }> = {
  ACCEPTED: { label: "Confirmed", cls: "bg-[#e6f6ea] text-[#2a9d4a]" },
  PENDING: { label: "Awaiting", cls: "bg-[#fdf3e1] text-[#c77700]" },
  DECLINED: { label: "Declined", cls: "bg-[#f0f0f2] text-[#6e6e73]" },
};
const NEXT: Record<GuestListRow["rsvpStatus"], GuestListRow["rsvpStatus"]> = { ACCEPTED: "PENDING", PENDING: "DECLINED", DECLINED: "ACCEPTED" };
const FILTERS = ["All", "Confirmed", "Awaiting", "Declined"] as const;

export function GuestListClient({ bookingId, initial }: { bookingId: string; initial: { stats: Stats; guests: GuestListRow[] } }) {
  const router = useRouter();
  const [guests, setGuests] = React.useState(initial.guests);
  const [input, setInput] = React.useState("");
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("All");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const heads = (g: GuestListRow) => 1 + g.plusOnes;
  const stats = React.useMemo(() => ({
    confirmed: guests.filter((g) => g.rsvpStatus === "ACCEPTED").reduce((a, g) => a + heads(g), 0),
    declined: guests.filter((g) => g.rsvpStatus === "DECLINED").reduce((a, g) => a + heads(g), 0),
    pending: guests.filter((g) => g.rsvpStatus === "PENDING").reduce((a, g) => a + heads(g), 0),
    total: guests.reduce((a, g) => a + heads(g), 0),
  }), [guests]);
  const veg = guests.filter((g) => /veg/i.test(g.dietary ?? "") && !/non/i.test(g.dietary ?? "")).length;

  function flash(msg: string) { setNote(msg); setTimeout(() => setNote(null), 2200); }

  async function add() {
    const name = input.trim(); if (!name) return;
    setBusy("add");
    const res = await addGuestQuick(bookingId, name);
    setBusy(null);
    if (!res.success) return flash(res.error);
    setGuests((g) => [{ id: res.data.id, name, category: "OTHER", plusOnes: 0, rsvpStatus: "PENDING", dietary: null, invited: false }, ...g]);
    setInput("");
  }
  async function cycle(g: GuestListRow) {
    const next = NEXT[g.rsvpStatus];
    setGuests((gs) => gs.map((x) => (x.id === g.id ? { ...x, rsvpStatus: next } : x)));
    const res = await portalSetGuestRsvp(bookingId, g.id, next);
    if (!res.success) { setGuests((gs) => gs.map((x) => (x.id === g.id ? { ...x, rsvpStatus: g.rsvpStatus } : x))); flash(res.error); }
  }
  async function inviteAll() {
    setBusy("all");
    const res = await portalBulkSendInvitations(bookingId);
    setBusy(null);
    if (!res.success) return flash(res.error);
    setGuests((gs) => gs.map((x) => ({ ...x, invited: true })));
    flash(`${res.data.sent} invitation${res.data.sent === 1 ? "" : "s"} sent${res.data.skipped ? ` · ${res.data.skipped} skipped` : ""}`);
    router.refresh();
  }
  async function invite(g: GuestListRow) {
    setBusy(g.id);
    const res = await portalSendInvitation(bookingId, g.id);
    setBusy(null);
    if (!res.success) return flash(res.error);
    setGuests((gs) => gs.map((x) => (x.id === g.id ? { ...x, invited: true } : x)));
    flash(res.data.sent ? `Invitation sent to ${g.name}` : `Invitation queued for ${g.name}`);
    router.refresh();
  }

  const visible = guests.filter((g) => filter === "All" || (filter === "Confirmed" && g.rsvpStatus === "ACCEPTED") || (filter === "Awaiting" && g.rsvpStatus === "PENDING") || (filter === "Declined" && g.rsvpStatus === "DECLINED"));
  const pctYes = stats.total ? Math.round((stats.confirmed / stats.total) * 100) : 0;
  const pctNo = stats.total ? Math.round((stats.declined / stats.total) * 100) : 0;

  return (
    <div className="vg-rise flex flex-col gap-4 px-5 pt-[calc(var(--sat)+0.5rem)]">
      <ScreenHeader title="Guest list" backHref="/app/event" action={guests.some((g) => !g.invited) ? <button type="button" onClick={inviteAll} disabled={busy === "all"} className="rounded-full bg-[#f7eef2] px-3.5 py-2 text-detail font-semibold text-[#6d1b52] disabled:opacity-60">{busy === "all" ? "Sending…" : "Invite all"}</button> : undefined} />
      {note && <div className="vg-rise fixed inset-x-5 top-[calc(var(--sat)+0.75rem)] z-30 mx-auto flex max-w-md items-center gap-2.5 rounded-[14px] bg-[#1d1d1f]/[.92] px-4 py-3 text-detail font-medium text-white backdrop-blur"><span className="size-2 rounded-full bg-[#e8b631]" />{note}</div>}

      <Card className="rounded-[18px] p-4">
        <div className="flex items-baseline justify-between"><div className="numeric text-[28px] font-semibold tracking-[-.02em]">{stats.confirmed} <span className="text-detail font-medium tracking-normal text-[#6e6e73]">confirmed</span></div><div className="text-detail text-[#6e6e73]">of {stats.total} invited</div></div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#e9e9ec]"><div className="bg-[#6d1b52]" style={{ width: `${pctYes}%` }} /><div className="bg-[#d1d1d6]" style={{ width: `${pctNo}%` }} /></div>
        <div className="mt-2.5 flex gap-3.5 text-meta text-[#6e6e73]"><span><b className="text-[#1d1d1f]">{stats.pending}</b> awaiting</span><span><b className="text-[#1d1d1f]">{stats.declined}</b> declined</span>{veg > 0 && <span><b className="text-[#1d1d1f]">{veg}</b> veg</span>}</div>
      </Card>

      <div className="flex items-center gap-2 rounded-[14px] border border-black/[.08] bg-white py-1 pl-3.5 pr-1">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a guest or family…" className="min-h-9 min-w-0 flex-1 bg-transparent text-body text-[#1d1d1f] focus:outline-none" />
        <button type="button" onClick={add} disabled={busy === "add"} className="h-9 rounded-[10px] bg-[#6d1b52] px-3.5 text-detail font-semibold text-[#fdf5f3] disabled:opacity-60">{busy === "add" ? <Loader2 className="size-4 animate-spin" /> : "Add"}</button>
      </div>

      <div className="flex gap-1.5">{FILTERS.map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)} className="min-h-8 px-3 py-1.5 text-meta">{f}</Chip>)}</div>

      <Card className="vg-divide overflow-hidden">
        {visible.length === 0 && <div className="px-4 py-6 text-center text-body text-[#6e6e73]">{guests.length === 0 ? "Add your first guest above. Each one can get a personal RSVP link on WhatsApp." : "Nobody in this filter."}</div>}
        {visible.map((g, i) => (
          <div key={g.id} className="flex items-center gap-3 px-3.5 py-2.5">
            <Avatar text={initialsTone(g.name)} tone={i % 2 ? "gold" : "plum"} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-body font-semibold">{g.name}</div>
              <div className="text-meta text-[#6e6e73]">{g.category !== "OTHER" ? `${g.category.charAt(0) + g.category.slice(1).toLowerCase()} · ` : ""}{1 + g.plusOnes} {g.plusOnes ? "people" : "person"}{g.dietary ? ` · ${g.dietary}` : ""}{g.invited ? " · invited" : ""}</div>
            </div>
            {!g.invited && (
              <button type="button" aria-label={`Send RSVP link to ${g.name}`} onClick={() => invite(g)} disabled={busy === g.id} className="flex size-8 items-center justify-center rounded-full bg-[#f7eef2] text-[#6d1b52] disabled:opacity-50">{busy === g.id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}</button>
            )}
            <button type="button" onClick={() => cycle(g)} className={`rounded-full px-2.5 py-1.5 text-meta font-semibold ${ST[g.rsvpStatus].cls}`} title="Tap to change">{ST[g.rsvpStatus].label}</button>
          </div>
        ))}
      </Card>
      <p className="text-center text-meta text-[#8a8a8e]">Tap a status to change it by hand. The paper-plane sends that guest their own RSVP link on WhatsApp.</p>
    </div>
  );
}
