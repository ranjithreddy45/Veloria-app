"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUp, Check, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicContact } from "@/lib/public/business-contact";
import {
  getMyConversation,
  markConciergeRead,
  sendConciergeMessage,
  type ConciergeMessageDTO,
  type CustomerConversation,
} from "@/actions/guest-concierge.actions";
import { mergeTimeline, type RequestEntry } from "../_lib/concierge-rules";
import { ContactLinks } from "../../../_components/contact-links";
import { PushOptIn } from "../../../_components/push-opt-in";

// ============================================================
// Concierge: the customer's conversation with the Veloria team.
//
// These messages are the same records the team inbox shows. Nothing is staged:
// no online dot, no typing indicator, no promised reply time (only the team's
// published hours, when Settings has them). "Seen by the team" appears only
// once someone on the team has opened the conversation. New replies load while
// the screen is open (every 20 seconds) and also arrive as notifications.
// ============================================================

const IST = "Asia/Kolkata";
const POLL_MS = 20_000;
/** Starters that fill the box. Nothing is sent until the customer taps send. */
const STARTERS = ["Change the guest count", "Book a menu tasting", "Parking for guests", "A question about decor"];

type Shown = ConciergeMessageDTO & { pending?: boolean };

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));
const timeOf = (iso: string) => timeFmt.format(new Date(iso));

export function ConciergeChat({
  initial,
  contact,
  contactContext,
}: {
  initial: CustomerConversation;
  /** Settings → Business contact, loaded by the page with getPublicContact(). */
  contact: PublicContact;
  /** Prefilled WhatsApp text. */
  contactContext: string;
}) {
  const [conv, setConv] = React.useState(initial);
  const [pending, setPending] = React.useState<{ id: string; body: string; createdAt: string }[]>([]);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const scrollEnd = React.useRef<HTMLDivElement>(null);

  const bookingId = conv.booking?.id ?? null;
  const ready = conv.state === "READY";
  const canWrite = ready && conv.canSend;
  const hasContactOptions = Boolean(contact.phone || contact.whatsapp);

  const refresh = React.useCallback(async () => {
    const next = await getMyConversation(bookingId);
    // Only accept the same booking's conversation; switching bookings re-renders the page.
    if (next.state === "READY" && (next.booking?.id ?? null) === bookingId) setConv(next);
  }, [bookingId]);

  // Stay current while on screen: refresh at once if this view came from cache, then every 20s.
  const initialSyncedAt = initial.syncedAt;
  React.useEffect(() => {
    if (!ready) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    if (Date.now() - Date.parse(initialSyncedAt) > 5_000) tick();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [ready, refresh, initialSyncedAt]);

  // The host or a co-host opening the conversation marks the team's messages as seen. Viewers and staff previews never do.
  const threadId = conv.threadId;
  const unread = conv.unread;
  const marksSeen = conv.canSend;
  React.useEffect(() => {
    if (!marksSeen || !threadId || unread === 0) return;
    const mark = () => {
      if (document.visibilityState === "visible") void markConciergeRead(threadId);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [marksSeen, threadId, unread]);

  const count = conv.messages.length + conv.requests.length + pending.length;
  React.useEffect(() => {
    scrollEnd.current?.scrollIntoView({ block: "end" });
  }, [count]);

  async function send() {
    const body = text.trim();
    if (!body || busy || !canWrite) return;
    const temp = { id: `pending-${Date.now()}`, body, createdAt: new Date().toISOString() };
    setBusy(true);
    setError(null);
    setText("");
    setPending((p) => [...p, temp]);
    const res = await sendConciergeMessage({ bookingId, body });
    setPending((p) => p.filter((x) => x.id !== temp.id));
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      setText((current) => current || body);
      return;
    }
    setConv((c) => ({
      ...c,
      threadId: res.data.threadId,
      threadStatus: "OPEN",
      messages: [...c.messages.map((m) => (m.receipt ? { ...m, receipt: null } : m)), res.data.message],
    }));
  }

  const shown: Shown[] = [
    ...conv.messages,
    ...pending.map(
      (p): Shown => ({ id: p.id, author: "CUSTOMER", body: p.body, createdAt: p.createdAt, mine: true, authorName: null, receipt: null, unread: false, pending: true })
    ),
  ];
  const timeline = mergeTimeline(shown, conv.requests);
  const firstUnreadId = conv.messages.find((m) => m.unread)?.id ?? null;
  const todayKey = dayKey(conv.syncedAt);
  const yesterdayKey = dayKey(new Date(Date.parse(conv.syncedAt) - 86_400_000).toISOString());
  const dayTitle = (iso: string) => {
    const k = dayKey(iso);
    return k === todayKey ? "Today" : k === yesterdayKey ? "Yesterday" : dayFmt.format(new Date(iso));
  };
  const hasOwnMessage = conv.messages.some((m) => m.mine);
  const coordinatorFirst = conv.coordinator?.name.split(" ")[0] ?? null;
  const audience =
    conv.access === "HOST" && conv.sharedWith > 0
      ? ` ${conv.sharedWith === 1 ? "The co-host" : `The ${conv.sharedWith} co-hosts`} you invited to this booking can read it too.`
      : conv.access === "CO_HOST"
        ? " The host and the booking's other co-hosts can read it too."
        : "";
  const intro =
    conv.threadStatus === "CLOSED"
      ? `The team marked this conversation as resolved.${conv.canSend ? " Write any time and it opens again." : ""}`
      : conv.canSend
        ? `Messages here go to ${coordinatorFirst ?? "the events team"} and stay in one conversation with the team.${audience} Replies appear here and in Notifications.`
        : `This is the conversation with ${coordinatorFirst ?? "the events team"} about this booking.${audience}`;

  return (
    <div className="vg-rise flex min-h-[calc(100vh-6rem-var(--sab))] flex-col gap-4 px-5 pt-[calc(var(--sat)+1rem)]">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-[#f7eef2] text-detail font-semibold text-[#6d1b52]"
        >
          {conv.coordinator?.initials ?? "VG"}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-editorial text-[22px] font-semibold leading-[1.1] tracking-[-.01em]">Concierge</h1>
          <p className="mt-0.5 truncate text-meta text-[#6e6e73]">
            {conv.coordinator ? `${conv.coordinator.name} · ${conv.coordinator.role}` : "Veloria events team"}
          </p>
          {contact.supportHours && <p className="truncate text-meta text-[#6e6e73]">Team hours: {contact.supportHours}</p>}
        </div>
      </div>

      {conv.bookings.length > 1 && !conv.preview && (
        <nav aria-label="Choose an event" className="vg-scroll-x vg-bleed gap-1.5">
          {conv.bookings.map((b) => (
            <Link
              key={b.id}
              href={`/app/concierge?booking=${b.id}`}
              aria-current={b.id === bookingId ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 py-2 text-detail font-semibold",
                b.id === bookingId ? "border-[#6d1b52] bg-[#6d1b52] text-[#fdf5f3]" : "border-black/[.08] bg-white text-[#1d1d1f]"
              )}
            >
              {b.eventName}
            </Link>
          ))}
        </nav>
      )}

      {conv.preview && (
        <div className="rounded-2xl border border-[#ead9a6] bg-[#faf3e1] px-4 py-3 text-detail leading-[1.5] text-[#5c4a14]">
          <span className="font-semibold">Staff preview.</span> You&apos;re reading this customer&apos;s conversation as they see it.
          Opening it here doesn&apos;t mark anything as seen. Reply from the{" "}
          <Link href={conv.threadId ? `/concierge?thread=${conv.threadId}` : "/concierge"} className="font-semibold underline">
            team inbox
          </Link>
          .
        </div>
      )}

      {conv.state === "NO_ACCESS" ? (
        <div className="vg-card flex flex-col gap-3 rounded-2xl p-4 text-detail leading-[1.55] text-[#3a3a3c]">
          <p>
            <span className="font-semibold text-[#1d1d1f]">Messages with the team are for the host and co-hosts.</span> You were
            invited to view this event, so this conversation stays with them. If you need something, ask the host.
          </p>
          {hasContactOptions && <p>You can also reach the team directly:</p>}
          <ContactLinks contact={contact} context={contactContext} />
        </div>
      ) : !ready ? (
        <div className="vg-card flex flex-col gap-3 rounded-2xl p-4 text-detail leading-[1.55] text-[#3a3a3c]">
          <p>
            <span className="font-semibold text-[#1d1d1f]">This sign-in isn&apos;t linked to an enquiry or booking yet.</span> Messages here go
            to the person looking after your event, so we need one of those first.
          </p>
          {hasContactOptions && <p>Until then, you can reach the team directly:</p>}
          <ContactLinks contact={contact} context={contactContext} />
          <Link href="/app/book/enquire" className="font-semibold text-[#6d1b52]">
            Send an enquiry
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2">
          <p className="rounded-2xl bg-white/70 px-4 py-3 text-detail leading-[1.5] text-[#6e6e73]">{intro}</p>
          {hasContactOptions && (
            <div className="flex flex-col gap-2">
              <p className="px-1 text-meta font-semibold text-[#636368]">Prefer to talk?</p>
              <ContactLinks contact={contact} context={contactContext} />
            </div>
          )}

          {timeline.map((entry, i) => {
            const prev = timeline[i - 1];
            const showDay = !prev || dayKey(prev.item.createdAt) !== dayKey(entry.item.createdAt);
            return (
              <React.Fragment key={`${entry.type}-${entry.item.id}`}>
                {showDay && (
                  <p className="mt-2 self-center text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#636368]">
                    {dayTitle(entry.item.createdAt)}
                  </p>
                )}
                {entry.type === "message" && entry.item.id === firstUnreadId && (
                  <p className="flex items-center gap-2 text-[10.5px] font-semibold text-[#6d1b52]">
                    <span aria-hidden className="h-px flex-1 bg-[#6d1b52]/25" />
                    New from the team
                    <span aria-hidden className="h-px flex-1 bg-[#6d1b52]/25" />
                  </p>
                )}
                {entry.type === "message" ? <MessageBubble m={entry.item} /> : <RequestCard r={entry.item} />}
              </React.Fragment>
            );
          })}

          {canWrite && hasOwnMessage && <PushOptIn compact className="mt-2" />}
          <div ref={scrollEnd} />
        </div>
      )}

      {canWrite && (
        <>
          <div className="vg-glass vg-col vg-gutter fixed inset-x-0 bottom-[calc(var(--sab)+66px)] z-30 flex flex-col gap-2.5 pb-3 pt-3 lg:bottom-[calc(var(--sab)+12px)]">
            {conv.booking && conv.messages.length === 0 && (
              <div className="vg-scroll-x vg-bleed gap-1.5">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setText(s)}
                    className="shrink-0 rounded-full border border-black/[.08] bg-white px-3.5 py-2 text-detail font-medium"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-[22px] border border-black/[.08] bg-white py-1.5 pl-4 pr-1.5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Write to the team"
                aria-label="Message the team"
                className="field-sizing-content max-h-28 min-h-8 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-body focus:outline-none"
              />
              <button
                type="button"
                aria-label="Send"
                onClick={() => void send()}
                disabled={busy || !text.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#6d1b52] text-[#fdf5f3] disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </button>
            </div>
            {error && (
              <p role="alert" className="text-meta text-[#b3261e]">
                {error}
              </p>
            )}
          </div>
          <div aria-hidden className="h-36 shrink-0" />
        </>
      )}
    </div>
  );
}

function MessageBubble({ m }: { m: Shown }) {
  if (m.author === "SYSTEM") {
    return <p className="my-1 self-center rounded-full bg-black/[.05] px-3 py-1 text-center text-meta text-[#6e6e73]">{m.body}</p>;
  }
  const customerSide = m.author === "CUSTOMER";
  // Customer-side messages sit on the right; ones written by someone else on the booking carry that person's name.
  const label = customerSide ? (m.mine ? null : m.authorName) : m.authorName ? `${m.authorName} · Veloria team` : "Veloria team";
  return (
    <div className={cn("flex flex-col gap-1", customerSide ? "items-end" : "items-start")}>
      {label && <span className="px-1 text-[10.5px] font-medium text-[#636368]">{label}</span>}
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2.5 text-body leading-[1.45]",
          customerSide ? "rounded-br-md bg-[#6d1b52] text-[#fdf5f3]" : "rounded-bl-md bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,.04)]",
          m.pending && "opacity-70"
        )}
      >
        {m.body}
      </div>
      <span className="flex items-center gap-1 px-1 text-[10.5px] text-[#636368]">
        {timeOf(m.createdAt)}
        {m.pending ? (
          <span>· Sending…</span>
        ) : m.receipt?.state === "SEEN" ? (
          <>
            <span aria-hidden>·</span>
            <CheckCheck className="size-3" aria-hidden />
            <span>Seen by the team</span>
          </>
        ) : m.receipt?.state === "SENT" ? (
          <>
            <span aria-hidden>·</span>
            <Check className="size-3" aria-hidden />
            <span>Sent</span>
          </>
        ) : null}
      </span>
    </div>
  );
}

function RequestCard({ r }: { r: RequestEntry }) {
  return (
    <div className="my-1 w-full rounded-2xl border border-dashed border-black/[.12] bg-white/70 px-3.5 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-detail font-semibold text-[#1d1d1f]">{r.label}</span>
        <span className={cn("shrink-0 text-meta font-semibold", r.status === "DONE" ? "text-[#2a9d4a]" : "text-[#b88513]")}>
          {r.statusLabel}
        </span>
      </div>
      <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-detail leading-[1.45] text-[#6e6e73]">{r.text}</p>
      <p className="mt-1 text-[10.5px] text-[#636368]">{timeOf(r.createdAt)}</p>
    </div>
  );
}
