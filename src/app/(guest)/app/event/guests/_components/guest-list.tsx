"use client";

import * as React from "react";
import { Copy, Loader2, Minus, Plus, Send, Share2 } from "lucide-react";
import {
  hostAddGuest,
  hostGetRsvpLink,
  hostInviteAllGuests,
  hostSendGuestInvite,
  hostSetGuestPhone,
  hostSetGuestRsvp,
  type HostGuestListData,
  type HostGuestRow,
} from "@/actions/portal-guest.actions";
import { RSVP_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import { GUEST_CATEGORY_LABELS } from "@/lib/constants";
import { buildInvitationMessage } from "@/lib/invitation-message-builder";
import { guestCounts } from "../../_components/event-view";
import {
  GUEST_INVITE_STATE_LABEL,
  canShareRsvpLink,
  countInviteStates,
  guestInviteState,
  type GuestInviteState,
  type InviteAllSummary,
} from "../_lib/guest-invites";
import { ScreenHeader, Card, Chip, Avatar, initialsTone } from "./guest-ui";

// ============================================================
// The host's guest list — the same Guest / GuestInvitation rows the team's
// guest list and check-in use. Totals come from guestCounts() (the team Guest
// Manager's definition: guests are records, people include plus-ones), every
// invitation state from guest-invites.ts, and every change goes through a host*
// action and comes back as the saved row.
// ============================================================

type Rsvp = HostGuestRow["rsvpStatus"];
type Filter = "ALL" | GuestInviteState;

const FILTERS: Filter[] = ["ALL", "NOT_INVITED", "INVITE_SENT", "RSVP_RECEIVED", "NO_PHONE"];
const CATEGORY_KEYS = ["FAMILY", "FRIEND", "VIP", "CORPORATE", "OTHER"] as const;
const RSVP_KEYS: Rsvp[] = ["ACCEPTED", "PENDING", "DECLINED"];

const STATE_TONE: Record<GuestInviteState, string> = {
  NOT_INVITED: "bg-[#f0f0f2] text-[#6e6e73]",
  INVITE_SENT: "bg-[#f7eef2] text-[#6d1b52]",
  RSVP_RECEIVED: "bg-[#e6f6ea] text-[#2a9d4a]",
  NO_PHONE: "bg-[#fdf3e1] text-[#c77700]",
};
const RSVP_TONE: Record<Rsvp, string> = {
  ACCEPTED: "bg-[#e6f6ea] text-[#2a9d4a]",
  PENDING: "bg-[#fdf3e1] text-[#c77700]",
  DECLINED: "bg-[#f0f0f2] text-[#6e6e73]",
};

const FIELD =
  "min-h-11 w-full min-w-0 rounded-[12px] border border-black/[.08] bg-white px-3.5 text-body text-[#1d1d1f] placeholder:text-[#8a8a8e] focus:border-[#6d1b52] focus:outline-none";
const GHOST_BTN =
  "flex h-10 items-center justify-center gap-2 rounded-[12px] border border-black/[.08] bg-white px-3 text-detail font-semibold text-[#1d1d1f] disabled:opacity-60";
const PRIMARY_BTN =
  "flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[#6d1b52] px-3.5 text-detail font-semibold text-[#fdf5f3] disabled:opacity-60";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** One status per row: the RSVP answer once there is one, otherwise the invitation state. */
function statusChip(g: HostGuestRow): { label: string; cls: string } {
  const state = guestInviteState(g);
  if (state === "RSVP_RECEIVED" && g.rsvpStatus !== "PENDING") {
    return { label: customerLabel(RSVP_STATUS_LABEL, g.rsvpStatus), cls: RSVP_TONE[g.rsvpStatus] };
  }
  return { label: GUEST_INVITE_STATE_LABEL[state], cls: STATE_TONE[state] };
}

/** wa.me with the text filled in — the fallback where the share sheet isn't available. */
function openWhatsApp(text: string, phone: string | null): boolean {
  const digits = (phone ?? "").replace(/\D/g, "");
  const w = window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank");
  if (!w) return false;
  w.opener = null;
  return true;
}

export function GuestListClient({ initial }: { initial: HostGuestListData }) {
  const { bookingId, canManage, preview, whatsappReady, invite } = initial;
  const [guests, setGuests] = React.useState(initial.guests);
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [rowError, setRowError] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<(InviteAllSummary & { message: string }) | null>(null);
  const [links, setLinks] = React.useState<Record<string, string>>({});
  const [linkLoading, setLinkLoading] = React.useState<string | null>(null);
  const [manualLink, setManualLink] = React.useState<{ id: string; url: string } | null>(null);
  const [phoneDraft, setPhoneDraft] = React.useState<Record<string, string>>({});

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [plusOnes, setPlusOnes] = React.useState(0);
  const [category, setCategory] = React.useState<string>("OTHER");
  const [formError, setFormError] = React.useState<string | null>(null);

  const noteTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
  }, []);
  function flash(msg: string) {
    setNote(msg);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 2800);
  }

  const tally = React.useMemo(() => guestCounts(guests), [guests]);
  const stateCounts = React.useMemo(() => countInviteStates(guests), [guests]);
  const veg = guests.filter((g) => /veg/i.test(g.dietary ?? "") && !/non/i.test(g.dietary ?? "")).length;

  function replaceGuest(row: HostGuestRow) {
    setGuests((gs) => gs.map((g) => (g.id === row.id ? row : g)));
  }
  function setErr(id: string, msg: string | null) {
    setRowError((e) => {
      const next = { ...e };
      if (msg) next[id] = msg;
      else delete next[id];
      return next;
    });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) return setFormError("Enter the guest's name.");
    setBusy("add");
    setFormError(null);
    const res = await hostAddGuest(bookingId, { name: clean, phone, plusOnes, category });
    setBusy(null);
    if (!res.success) return setFormError(res.error);
    setGuests((gs) => [res.data.guest, ...gs]);
    setName("");
    setPhone("");
    setPlusOnes(0);
    setCategory("OTHER");
    flash(res.data.guest.phone ? `Added ${res.data.guest.name}` : `Added ${res.data.guest.name} — no phone yet`);
  }

  /** The guest's RSVP link: already known, or fetched (which creates it without marking anything sent). */
  async function fetchLink(g: HostGuestRow): Promise<string | null> {
    const known = g.rsvpUrl ?? links[g.id];
    if (known) return known;
    setLinkLoading(g.id);
    const res = await hostGetRsvpLink(bookingId, g.id);
    setLinkLoading((x) => (x === g.id ? null : x));
    if (!res.success) {
      setErr(g.id, res.error);
      return null;
    }
    setLinks((l) => ({ ...l, [g.id]: res.data.url }));
    replaceGuest(res.data.guest);
    return res.data.url;
  }

  function toggleRow(g: HostGuestRow) {
    const next = expanded === g.id ? null : g.id;
    setExpanded(next);
    setManualLink(null);
    // Fetch the link while the row opens, so Copy and Share run straight from the tap
    // (phones refuse clipboard and share-sheet calls that come long after a tap).
    if (next && canShareRsvpLink(g) && !g.rsvpUrl && !links[g.id]) void fetchLink(g);
  }

  async function copyLink(g: HostGuestRow) {
    const url = await fetchLink(g);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      flash("RSVP link copied — send it to them yourself");
    } catch {
      setManualLink({ id: g.id, url });
    }
  }

  async function shareLink(g: HostGuestRow) {
    const url = await fetchLink(g);
    if (!url) return;
    const text = buildInvitationMessage({ guestName: g.name, ...invite, rsvpLink: url });
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return; // closed the sheet
      }
    }
    if (!openWhatsApp(text, g.phone)) setManualLink({ id: g.id, url });
  }

  async function sendInvite(g: HostGuestRow) {
    setBusy(`invite:${g.id}`);
    setErr(g.id, null);
    const res = await hostSendGuestInvite(bookingId, g.id);
    setBusy(null);
    if (!res.success) return setErr(g.id, res.error);
    replaceGuest(res.data.guest);
    flash(`Invitation sent to ${g.name} on WhatsApp`);
  }

  async function inviteAll() {
    setBusy("all");
    const res = await hostInviteAllGuests(bookingId);
    setBusy(null);
    if (!res.success) return flash(res.error);
    setGuests(res.data.guests);
    setResult({ ...res.data.summary, message: res.data.message });
    setExpanded(null);
  }

  async function savePhone(g: HostGuestRow) {
    const value = (phoneDraft[g.id] ?? "").trim();
    if (!value) return setErr(g.id, "Enter a phone number.");
    setBusy(`phone:${g.id}`);
    setErr(g.id, null);
    const res = await hostSetGuestPhone(bookingId, g.id, value);
    setBusy(null);
    if (!res.success) return setErr(g.id, res.error);
    replaceGuest(res.data.guest);
    setPhoneDraft((d) => {
      const next = { ...d };
      delete next[g.id];
      return next;
    });
    flash(`Saved ${g.name}'s number`);
  }

  async function setRsvp(g: HostGuestRow, status: Rsvp) {
    if (status === g.rsvpStatus) return;
    replaceGuest({ ...g, rsvpStatus: status });
    setBusy(`rsvp:${g.id}`);
    setErr(g.id, null);
    const res = await hostSetGuestRsvp(bookingId, g.id, status);
    setBusy(null);
    if (!res.success) {
      replaceGuest(g);
      return setErr(g.id, res.error);
    }
    replaceGuest(res.data.guest);
  }

  const visible = filter === "ALL" ? guests : guests.filter((g) => guestInviteState(g) === filter);
  const pctYes = tally.onList ? Math.round((tally.attending / tally.onList) * 100) : 0;
  const pctNo = tally.onList ? Math.round((tally.declined / tally.onList) * 100) : 0;
  const canInviteAll = canManage && whatsappReady && stateCounts.NOT_INVITED > 0;

  function renderActions(g: HostGuestRow) {
    const state = guestInviteState(g);
    const shareable = canShareRsvpLink(g);
    const loadingLink = linkLoading === g.id && !(g.rsvpUrl ?? links[g.id]);
    return (
      <div className="flex flex-col gap-2.5 bg-[#fafafb] px-3.5 pb-3.5 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-meta text-[#6e6e73]">RSVP</span>
          {RSVP_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRsvp(g, k)}
              disabled={busy === `rsvp:${g.id}`}
              aria-pressed={g.rsvpStatus === k}
              className={`rounded-full px-2.5 py-1.5 text-meta font-semibold ${g.rsvpStatus === k ? RSVP_TONE[k] : "border border-black/[.08] bg-white text-[#6e6e73]"}`}
            >
              {customerLabel(RSVP_STATUS_LABEL, k)}
            </button>
          ))}
        </div>

        {state === "NO_PHONE" && (
          <div className="flex items-center gap-2">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phoneDraft[g.id] ?? ""}
              onChange={(e) => setPhoneDraft((d) => ({ ...d, [g.id]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && savePhone(g)}
              placeholder="Add their WhatsApp number"
              aria-label={`WhatsApp number for ${g.name}`}
              className={`${FIELD} min-h-10`}
            />
            <button type="button" onClick={() => savePhone(g)} disabled={busy === `phone:${g.id}`} className={`${PRIMARY_BTN} shrink-0`}>
              {busy === `phone:${g.id}` ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </button>
          </div>
        )}

        {state === "NOT_INVITED" && whatsappReady && (
          <button type="button" onClick={() => sendInvite(g)} disabled={busy === `invite:${g.id}`} className={PRIMARY_BTN}>
            {busy === `invite:${g.id}` ? <Loader2 className="size-4 animate-spin" /> : <><Send className="size-3.5" /> Send invite on WhatsApp</>}
          </button>
        )}
        {state === "INVITE_SENT" && (
          <p className="text-meta text-[#6e6e73]">
            Invitation sent{g.invitation?.sentAt ? ` on ${shortDate(g.invitation.sentAt)}` : ""}. Their reply will show here.
          </p>
        )}
        {state === "RSVP_RECEIVED" && (
          <p className="text-meta text-[#6e6e73]">
            {g.invitation?.rsvpRespondedAt ? `Replied through their RSVP link on ${shortDate(g.invitation.rsvpRespondedAt)}.` : "Reply recorded by hand."}
          </p>
        )}

        {shareable && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copyLink(g)} disabled={loadingLink} className={GHOST_BTN}>
                {loadingLink ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-3.5" />} Copy RSVP link
              </button>
              <button type="button" onClick={() => shareLink(g)} disabled={loadingLink} className={GHOST_BTN}>
                <Share2 className="size-3.5" /> Share
              </button>
            </div>
            {manualLink?.id === g.id && (
              <input readOnly value={manualLink.url} onFocus={(e) => e.currentTarget.select()} aria-label={`RSVP link for ${g.name}`} className={`${FIELD} min-h-10 text-meta`} />
            )}
            <p className="text-meta text-[#8a8a8e]">A link you copy or share yourself isn&apos;t marked as sent. Their reply still shows up here.</p>
          </>
        )}

        {rowError[g.id] && <p role="alert" className="text-meta text-[#b3261e]">{rowError[g.id]}</p>}
      </div>
    );
  }

  return (
    <div className="vg-rise flex flex-col gap-4 px-5 pt-[calc(var(--sat)+0.5rem)]">
      <ScreenHeader
        title="Guest list"
        sub={initial.eventName}
        backHref={`/app/event?b=${bookingId}`}
        action={
          canInviteAll ? (
            <button type="button" onClick={inviteAll} disabled={busy === "all"} className="rounded-full bg-[#f7eef2] px-3.5 py-2 text-detail font-semibold text-[#6d1b52] disabled:opacity-60">
              {busy === "all" ? "Sending…" : "Invite all"}
            </button>
          ) : undefined
        }
      />
      {note && (
        <div role="status" aria-live="polite" className="vg-rise fixed inset-x-5 top-[calc(var(--sat)+0.75rem)] z-30 mx-auto flex max-w-md items-center gap-2.5 rounded-[14px] bg-[#1d1d1f]/[.92] px-4 py-3 text-detail font-medium text-white backdrop-blur">
          <span className="size-2 shrink-0 rounded-full bg-[#e8b631]" />
          {note}
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-[#b88513]/35 bg-[#faf3e1] px-3.5 py-2.5 text-detail text-[#6e4f0e]">
          <span className="font-semibold">Staff preview.</span> This is the host&apos;s guest list, read-only.
        </div>
      )}
      {!preview && initial.role === "VIEWER" && (
        <div className="rounded-xl bg-[#f7eef2] px-3.5 py-2.5 text-detail text-[#6d1b52]">You can see this guest list. Only the host or a co-host can make changes.</div>
      )}
      {canManage && initial.invitesBlockedReason && (
        <div className="rounded-xl border border-black/[.08] bg-white px-3.5 py-2.5 text-detail text-[#6e6e73]">
          {initial.invitesBlockedReason}
        </div>
      )}
      {canManage && !whatsappReady && !initial.invitesBlockedReason && (
        <div className="rounded-xl border border-black/[.08] bg-white px-3.5 py-2.5 text-detail text-[#6e6e73]">
          WhatsApp invitations aren&apos;t switched on yet. Tap a guest to copy or share their RSVP link — replies still show up here.
        </div>
      )}

      {result && (
        <Card className="rounded-[18px] p-4">
          <div role="status" aria-live="polite" className="text-body font-semibold text-[#1d1d1f]">{result.message}</div>
          <dl className="mt-3 flex flex-col gap-1.5 text-detail">
            <ResultRow label="Sent on WhatsApp" value={result.sent} />
            <ResultRow label="Need a phone number" value={result.needPhone} action={result.needPhone > 0 ? { label: "Show", onClick: () => setFilter("NO_PHONE") } : undefined} />
            {result.failed > 0 && <ResultRow label="Couldn't be sent" value={result.failed} />}
            {result.skipped > 0 && <ResultRow label="Already being sent" value={result.skipped} />}
            {result.later > 0 && <ResultRow label="Still to send — tap Invite all again" value={result.later} />}
            {result.limited > 0 && <ResultRow label="Over the 24-hour limit — send later" value={result.limited} />}
            <ResultRow label="Invited earlier" value={result.alreadyInvited} />
            <ResultRow label="Already replied" value={result.replied} />
          </dl>
          {result.failed > 0 && <p className="mt-2 text-meta text-[#6e6e73]">Open those guests to share their RSVP link yourself.</p>}
          <button type="button" onClick={() => setResult(null)} className="mt-3 text-detail font-semibold text-[#6d1b52]">Done</button>
        </Card>
      )}

      <Card className="rounded-[18px] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="numeric text-[28px] font-semibold tracking-[-.02em]">
            {tally.attending}{" "}
            <span className="text-detail font-medium tracking-normal text-[#6e6e73]">{tally.attending === 1 ? "guest" : "guests"} attending</span>
          </div>
          <div className="numeric text-right text-detail text-[#6e6e73]">
            {count(tally.onList, "guest", "guests")} · {count(tally.invitedHeads, "person", "people")}
          </div>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#e9e9ec]">
          <div className="bg-[#6d1b52]" style={{ width: `${pctYes}%` }} />
          <div className="bg-[#d1d1d6]" style={{ width: `${pctNo}%` }} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-meta text-[#6e6e73]">
          <span><b className="text-[#1d1d1f]">{tally.notReplied}</b> not replied</span>
          <span><b className="text-[#1d1d1f]">{tally.declined}</b> not attending</span>
          {tally.checkedIn > 0 && <span><b className="text-[#1d1d1f]">{tally.checkedIn}</b> checked in</span>}
          {veg > 0 && <span><b className="text-[#1d1d1f]">{veg}</b> veg</span>}
        </div>
        <p className="mt-2 text-meta text-[#8a8a8e]">Guests are the names on your list; people also counts their plus-ones.</p>
      </Card>

      {canManage && (
        <form onSubmit={add} className="vg-card rounded-2xl p-3.5">
          <div className="text-copy font-semibold">Add a guest</div>
          <div className="mt-2.5 flex flex-col gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="Name of guest or family" aria-label="Guest name" className={FIELD} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="off" placeholder="WhatsApp number (optional)" aria-label="WhatsApp number" className={FIELD} />
            <div className="flex items-center justify-between gap-3 py-0.5">
              <span className="text-detail text-[#6e6e73]">Plus-ones</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="One fewer plus-one" onClick={() => setPlusOnes((n) => Math.max(0, n - 1))} disabled={plusOnes === 0} className="flex size-8 items-center justify-center rounded-full border border-black/[.08] bg-white disabled:opacity-40">
                  <Minus className="size-3.5" />
                </button>
                <span className="numeric w-6 text-center text-body font-semibold" aria-live="polite">{plusOnes}</span>
                <button type="button" aria-label="One more plus-one" onClick={() => setPlusOnes((n) => Math.min(20, n + 1))} disabled={plusOnes >= 20} className="flex size-8 items-center justify-center rounded-full border border-black/[.08] bg-white disabled:opacity-40">
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
            <div className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CATEGORY_KEYS.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)} className="min-h-8 px-3 py-1.5 text-meta">
                  {GUEST_CATEGORY_LABELS[c] ?? c}
                </Chip>
              ))}
            </div>
          </div>
          {formError && <p role="alert" className="mt-2 text-meta text-[#b3261e]">{formError}</p>}
          <button type="submit" disabled={busy === "add"} className={`${PRIMARY_BTN} mt-3 w-full`}>
            {busy === "add" ? <Loader2 className="size-4 animate-spin" /> : "Add guest"}
          </button>
        </form>
      )}

      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)} className="min-h-8 px-3 py-1.5 text-meta">
            {f === "ALL" ? "All" : GUEST_INVITE_STATE_LABEL[f]}
            <span className="numeric ml-1.5 opacity-70">{f === "ALL" ? guests.length : stateCounts[f]}</span>
          </Chip>
        ))}
      </div>

      <Card className="vg-divide overflow-hidden">
        {visible.length === 0 && (
          <div className="px-4 py-6 text-center text-body text-[#6e6e73]">
            {guests.length === 0 ? (canManage ? "Add your first guest above. Each one gets their own RSVP link." : "No guests on the list yet.") : "Nobody in this filter."}
          </div>
        )}
        {visible.map((g, i) => {
          const chip = statusChip(g);
          const open = canManage && expanded === g.id;
          const meta = [
            g.category !== "OTHER" ? GUEST_CATEGORY_LABELS[g.category] ?? g.category : null,
            `${1 + g.plusOnes} ${g.plusOnes ? "people" : "person"}`,
            g.phoneDisplay,
            g.dietary,
          ].filter(Boolean).join(" · ");
          const rowInner = (
            <>
              <Avatar text={initialsTone(g.name)} tone={i % 2 ? "gold" : "plum"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-[#1d1d1f]">{g.name}</span>
                <span className="block truncate text-meta text-[#6e6e73]">{meta}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1.5 text-meta font-semibold ${chip.cls}`}>{chip.label}</span>
            </>
          );
          return (
            <div key={g.id}>
              {canManage ? (
                <button type="button" onClick={() => toggleRow(g)} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
                  {rowInner}
                </button>
              ) : (
                <div className="flex items-center gap-3 px-3.5 py-2.5">{rowInner}</div>
              )}
              {open && renderActions(g)}
            </div>
          );
        })}
      </Card>
      <p className="text-center text-meta text-[#8a8a8e]">
        {canManage
          ? "Tap a guest to record their reply, send their WhatsApp invitation or share their own RSVP link."
          : "Replies from each guest's RSVP link show up here."}
      </p>
    </div>
  );
}

function ResultRow({ label, value, action }: { label: string; value: number; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[#6e6e73]">{label}</dt>
      <dd className="flex items-center gap-2.5">
        {action && (
          <button type="button" onClick={action.onClick} className="text-meta font-semibold text-[#6d1b52]">
            {action.label}
          </button>
        )}
        <span className="numeric font-semibold text-[#1d1d1f]">{value}</span>
      </dd>
    </div>
  );
}
