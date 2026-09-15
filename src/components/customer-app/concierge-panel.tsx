"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessagesSquare,
  RotateCcw,
  Send,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import {
  assignConciergeThread,
  getConciergeAssignees,
  getConciergePanel,
  replyToConcierge,
  setConciergeThreadStatus,
  type AssigneeOption,
  type ConciergePanelData,
  type CustomerReachDTO,
  type InboxMessage,
  type InboxThreadDetail,
  type InboxThreadRow,
  type ReplyResult,
} from "@/actions/concierge-inbox.actions";
import { mergeTimeline, type RequestEntry } from "@/app/(guest)/app/concierge/_lib/concierge-rules";

// ============================================================
// Customer concierge, team side. ConciergeThreadView is the one conversation
// view used by the inbox (/concierge) and by ConciergePanel on booking and
// contact pages. The customer sees exactly these messages in their app.
// Nothing is simulated: "Seen by customer" comes from the customer opening
// the conversation, and after each reply the view says how, and whether, the
// customer was actually told.
// ============================================================

const IST = "Asia/Kolkata";
const stampFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" });
const stamp = (iso: string) => stampFmt.format(new Date(iso));

const TASK_LABEL: Record<string, string> = { TODO: "To do", IN_PROGRESS: "In progress", IN_REVIEW: "In review", DONE: "Done" };

const SKIP_TEXT: Record<string, string> = {
  NO_TEMPLATE: "no approved booking-update template is set in WhatsApp settings",
  NO_PHONE: "this contact has no usable phone number",
  OPTED_OUT: "the customer turned WhatsApp updates off",
  RECENTLY_SENT: "an update already went to them in the last 20 minutes",
  NO_CONTACT: "the contact record is missing",
};

const NONE = "__none__";
const PANEL_POLL_MS = 20_000;

function deliveryNote(d: ReplyResult["delivery"]): { text: string; warn: boolean } {
  const app =
    d.inApp > 0 ? `${d.inApp} customer app sign-in${d.inApp === 1 ? "" : "s"} notified` : "no customer app sign-in to notify";
  let wa = "";
  let waSent = false;
  switch (d.whatsapp.status) {
    case "SENT":
      wa = "WhatsApp update accepted by the provider";
      waSent = true;
      break;
    case "FAILED":
      wa = `WhatsApp update failed (${d.whatsapp.error})`;
      break;
    case "NO_ANSWER":
      wa = "the WhatsApp provider hasn't confirmed yet; the result will show in WhatsApp history";
      break;
    case "SKIPPED":
      wa = `no WhatsApp update: ${SKIP_TEXT[d.whatsapp.reason] ?? "not available"}`;
      break;
  }
  const warn = d.inApp === 0 && !waSent;
  return {
    text: `Reply saved · ${app} · ${wa}.${warn ? " The customer hasn't been told yet, so call or WhatsApp them if it matters." : ""}`,
    warn,
  };
}

function ReachNote({ reach }: { reach: CustomerReachDTO }) {
  const app =
    reach.appLogins === null
      ? "Couldn't check the customer's app sign-ins."
      : reach.appLogins === 0
        ? "No customer app sign-in is linked yet, so they'll only see replies once they sign in."
        : `Replies notify ${reach.appLogins} customer app sign-in${reach.appLogins === 1 ? "" : "s"}.`;
  const wa =
    reach.whatsapp === null
      ? "Couldn't check WhatsApp."
      : reach.whatsapp.ready
        ? `WhatsApp updates go to ${reach.whatsapp.phone}.`
        : `No WhatsApp updates: ${SKIP_TEXT[reach.whatsapp.reason] ?? "not available"}.`;
  const unreachable = reach.appLogins === 0 && reach.whatsapp !== null && !reach.whatsapp.ready;
  return (
    <div
      className={cn(
        "flex items-start gap-2 border-b px-4 py-2 text-xs",
        unreachable ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" : "text-muted-foreground"
      )}
    >
      {unreachable ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> : <Smartphone className="mt-0.5 size-3.5 shrink-0" />}
      <p>
        {app} {wa}
      </p>
    </div>
  );
}

function withCurrent(options: AssigneeOption[], t: InboxThreadRow): AssigneeOption[] {
  if (!t.assignedToId || options.some((o) => o.id === t.assignedToId)) return options;
  return [{ id: t.assignedToId, name: t.assigneeName ?? "Current assignee", role: "" }, ...options];
}

function TeamBubble({ m, customerName }: { m: InboxMessage; customerName: string }) {
  if (m.author === "SYSTEM") {
    return (
      <p className="py-1 text-center text-xs text-muted-foreground">
        {m.body}
        {m.authorName ? ` (${m.authorName})` : ""} · {stamp(m.createdAt)}
      </p>
    );
  }
  const team = m.author === "STAFF";
  return (
    <div className={cn("flex", team ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 shadow-sm",
          team ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card text-card-foreground"
        )}
      >
        <p className={cn("mb-0.5 text-meta font-medium", team ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {team ? m.authorName ?? "Team" : m.authorName ?? customerName}
        </p>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
        <p
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-meta",
            team ? "text-primary-foreground/75" : "text-muted-foreground"
          )}
        >
          {stamp(m.createdAt)}
          {team &&
            (m.seenAt ? (
              <>
                <CheckCheck className="size-3.5" aria-hidden /> Seen by customer
              </>
            ) : (
              <>
                <Check className="size-3.5" aria-hidden /> Not seen yet
              </>
            ))}
        </p>
      </div>
    </div>
  );
}

function RequestLine({ r }: { r: RequestEntry }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-dashed bg-background px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{r.label}</span>
        <Link href={`/tasks/${r.id}`} className="text-primary hover:underline">
          Task · {TASK_LABEL[r.status] ?? r.status}
        </Link>
      </div>
      <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{r.text}</p>
      <p className="mt-0.5 text-muted-foreground/80">
        {stamp(r.createdAt)} · the customer sees: {r.statusLabel}
      </p>
    </div>
  );
}

export interface ConciergeThreadViewProps {
  /** null when no conversation exists yet (panels): the composer then starts one for `target`. */
  detail: InboxThreadDetail | null;
  target?: ConciergePanelData["target"];
  reach: CustomerReachDTO;
  canReply: boolean;
  /** null hides the assign control. */
  assignees: AssigneeOption[] | null;
  /** Called after a reply, assignment or status change, so the owner reloads. */
  onChanged: () => void | Promise<void>;
  /** Mobile back button (inbox). */
  onBack?: () => void;
  syncError?: string | null;
  className?: string;
}

export function ConciergeThreadView({
  detail,
  target,
  reach,
  canReply,
  assignees,
  onChanged,
  onBack,
  syncError,
  className,
}: ConciergeThreadViewProps) {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ text: string; warn: boolean } | null>(null);
  const [sent, setSent] = React.useState<InboxMessage[]>([]);
  const scroller = React.useRef<HTMLDivElement>(null);

  // Switching to a different conversation clears the draft and notes (not when the first reply creates one).
  const threadId = detail?.thread.id ?? null;
  const [shownThread, setShownThread] = React.useState(threadId);
  if (shownThread !== threadId) {
    setShownThread(threadId);
    if (shownThread !== null) {
      setText("");
      setNote(null);
      setSent([]);
    }
  }

  const messages = React.useMemo(() => {
    const base = detail?.messages ?? [];
    const known = new Set(base.map((m) => m.id));
    return [...base, ...sent.filter((m) => !known.has(m.id))];
  }, [detail, sent]);
  const timeline = mergeTimeline(messages, detail?.requests ?? []);
  const customerName = (detail?.contact.name ?? target?.contactName ?? "Customer").split(" ")[0];

  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [timeline.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending || !canReply || (!detail && !target)) return;
    setSending(true);
    setNote(null);
    const res = await replyToConcierge(
      detail
        ? { threadId: detail.thread.id, bookingId: target?.bookingId ?? null, body }
        : { bookingId: target?.bookingId ?? null, contactId: target?.contactId ?? null, body }
    );
    setSending(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setText("");
    setSent((list) => [...list, res.data.message]);
    setNote(deliveryNote(res.data.delivery));
    await onChanged();
  }

  async function assign(value: string) {
    if (!detail) return;
    setBusy(true);
    const res = await assignConciergeThread(detail.thread.id, value === NONE ? null : value);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(res.data.assigneeName ? `Assigned to ${res.data.assigneeName}` : "Unassigned");
    await onChanged();
  }

  async function toggleStatus() {
    if (!detail) return;
    const next = detail.thread.status === "CLOSED" ? "OPEN" : "CLOSED";
    setBusy(true);
    const res = await setConciergeThreadStatus(detail.thread.id, next);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(next === "CLOSED" ? "Marked as resolved" : "Reopened");
    await onChanged();
  }

  const t = detail?.thread ?? null;
  const booking = detail?.booking ?? null;

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden" aria-label="Back to conversations">
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{detail?.contact.name ?? target?.contactName ?? "Customer"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {booking
              ? `${booking.bookingNumber} · ${booking.eventName} · ${dateFmt.format(new Date(booking.date))}`
              : detail
                ? "Enquiry · no booking yet"
                : "No conversation yet"}
            {detail?.contact.phone ? ` · ${detail.contact.phone}` : ""}
          </p>
        </div>
        {t && (
          <StatusPill
            size="sm"
            label={t.status === "CLOSED" ? "Resolved" : t.waitingOnTeam ? "Waiting on the team" : "Open"}
            hue={t.status === "CLOSED" ? "slate" : t.waitingOnTeam ? "amber" : "emerald"}
          />
        )}
        {detail?.task && (
          <Button variant="ghost" size="xs" asChild>
            <Link href={`/tasks/${detail.task.id}`}>Task · {TASK_LABEL[detail.task.status] ?? detail.task.status}</Link>
          </Button>
        )}
        {booking && (
          <Button variant="ghost" size="xs" asChild>
            <Link href={`/bookings/${booking.id}`}>
              Booking <ExternalLink className="size-3" />
            </Link>
          </Button>
        )}
        {detail && (
          <Button variant="ghost" size="xs" asChild>
            <Link href={`/contacts/${detail.contact.id}`}>
              Contact <ExternalLink className="size-3" />
            </Link>
          </Button>
        )}
      </div>

      {t && canReply && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          {assignees && (
            <Select value={t.assignedToId ?? NONE} onValueChange={assign} disabled={busy}>
              <SelectTrigger className="h-8 w-52" aria-label="Assigned to">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {withCurrent(assignees, t).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={toggleStatus} disabled={busy}>
            {t.status === "CLOSED" ? (
              <>
                <RotateCcw className="size-3.5" /> Reopen
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" /> Mark resolved
              </>
            )}
          </Button>
        </div>
      )}

      {canReply && <ReachNote reach={reach} />}

      {syncError && (
        <p className="flex items-center gap-2 border-b bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" /> Couldn&apos;t refresh: {syncError}
        </p>
      )}

      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/30 p-4">
        {timeline.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {detail
              ? "No messages yet."
              : "No messages with this customer yet. Write below to start the conversation; it appears in their app under Concierge."}
          </p>
        ) : (
          timeline.map((entry) =>
            entry.type === "message" ? (
              <TeamBubble key={entry.item.id} m={entry.item} customerName={customerName} />
            ) : (
              <RequestLine key={entry.item.id} r={entry.item} />
            )
          )
        )}
      </div>

      {canReply ? (
        <div className="border-t bg-background p-3">
          {note && (
            <p
              className={cn(
                "mb-2 rounded-md px-2.5 py-1.5 text-xs",
                note.warn ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" : "bg-muted text-muted-foreground"
              )}
            >
              {note.text}
            </p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={`Reply to ${customerName} (Ctrl+Enter to send)`}
              rows={2}
              maxLength={2000}
              aria-label="Reply to the customer"
              className="max-h-40 min-h-[44px] resize-none"
            />
            <Button onClick={() => void send()} disabled={!text.trim() || sending} size="icon" aria-label="Send reply">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          You can read this conversation. Replying needs permission to update bookings or message customers.
        </p>
      )}
    </div>
  );
}

/**
 * The customer conversation for one booking or contact, for the team's booking
 * and contact pages. Pass `bookingId` on a booking page or `contactId` on a
 * contact page. Customer messages count as seen by the team only while the
 * panel is actually on screen.
 */
export function ConciergePanel({
  bookingId,
  contactId,
  className,
}: {
  bookingId?: string | null;
  contactId?: string | null;
  className?: string;
}) {
  const [data, setData] = React.useState<ConciergePanelData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [assignees, setAssignees] = React.useState<AssigneeOption[] | null>(null);
  const [onScreen, setOnScreen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const load = React.useCallback(async () => {
    const res = await getConciergePanel(
      { bookingId: bookingId ?? null, contactId: contactId ?? null, threadId },
      { markRead: onScreen && document.visibilityState === "visible" }
    );
    if (res.success) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [bookingId, contactId, threadId, onScreen]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, PANEL_POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const canReply = data?.canReply ?? false;
  React.useEffect(() => {
    if (!canReply) return;
    let cancelled = false;
    getConciergeAssignees().then((res) => {
      if (!cancelled && res.success) setAssignees(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [canReply]);

  const detail = data?.detail ?? null;
  const unread = detail?.thread.unread ?? 0;

  return (
    <div ref={root} className={className}>
      <Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessagesSquare className="size-4" /> Customer concierge
            {unread > 0 && <Badge className="rounded-full">{unread} new</Badge>}
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={detail ? `/concierge?thread=${detail.thread.id}` : "/concierge"}>
              Inbox <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        {data && data.threads.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto border-b px-4 py-2">
            {data.threads.map((o) => (
              <Button
                key={o.id}
                size="xs"
                variant={o.id === detail?.thread.id ? "default" : "outline"}
                onClick={() => setThreadId(o.id)}
                className="shrink-0"
              >
                {o.label}
                {o.status === "CLOSED" ? " · resolved" : ""}
                {o.unread > 0 ? ` · ${o.unread} new` : ""}
              </Button>
            ))}
          </div>
        )}
        <CardContent className="h-[520px] p-0">
          {data ? (
            <ConciergeThreadView
              detail={detail}
              target={data.target}
              reach={data.reach}
              canReply={data.canReply}
              assignees={data.canReply ? assignees : null}
              onChanged={load}
              syncError={error}
            />
          ) : error ? (
            <p className="p-4 text-sm text-destructive">{error}</p>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading conversation…
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
