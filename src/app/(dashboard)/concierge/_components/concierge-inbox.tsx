"use client";

import * as React from "react";
import { ArrowLeft, Inbox, Loader2, MessagesSquare, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import { ConciergeThreadView } from "@/components/customer-app/concierge-panel";
import {
  getConciergeAssignees,
  getConciergeThread,
  listConciergeThreads,
  type AssigneeOption,
  type InboxAssigneeFilter,
  type InboxCounts,
  type InboxStatusFilter,
  type InboxThreadDetail,
  type InboxThreadRow,
} from "@/actions/concierge-inbox.actions";

// ============================================================
// Concierge inbox (client): conversation list with filters on the left, the
// shared ConciergeThreadView on the right. Refreshes every few seconds while
// the tab is visible; opening a conversation records the customer's messages
// as seen by the team.
// ============================================================

const IST = "Asia/Kolkata";
const rowTimeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const LIST_POLL_MS = 20_000;
const DETAIL_POLL_MS = 12_000;
const EMPTY_COUNTS: InboxCounts = { mineOpen: 0, unassignedOpen: 0, allOpen: 0, unreadConversations: 0 };

function writeUrl(next: { thread?: string | null; view?: InboxAssigneeFilter; status?: InboxStatusFilter }) {
  const params = new URLSearchParams(window.location.search);
  if (next.thread !== undefined) {
    if (next.thread) params.set("thread", next.thread);
    else params.delete("thread");
  }
  if (next.view) {
    if (next.view === "all") params.delete("view");
    else params.set("view", next.view);
  }
  if (next.status) {
    if (next.status === "OPEN") params.delete("status");
    else params.set("status", next.status.toLowerCase());
  }
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

function ThreadRowButton({ t, selected, onSelect }: { t: InboxThreadRow; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(t.id)}
      aria-current={selected ? "true" : undefined}
      className={cn("flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50", selected && "bg-muted")}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={cn("truncate text-sm", t.unread > 0 ? "font-semibold" : "font-medium")}>{t.contactName}</span>
        <span className="shrink-0 text-meta text-muted-foreground">{rowTimeFmt.format(new Date(t.lastMessageAt))}</span>
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {t.bookingNumber ? `${t.bookingNumber} · ${t.eventName ?? "Booking"}` : "Enquiry · no booking yet"}
      </span>
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs">
          {t.lastMessage ? `${t.lastMessage.author === "STAFF" ? "Team: " : ""}${t.lastMessage.excerpt}` : "No messages yet"}
        </span>
        {t.unread > 0 && (
          <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-meta tabular-nums" aria-label={`${t.unread} unread`}>
            {t.unread}
          </Badge>
        )}
      </span>
      <span className="text-meta text-muted-foreground">
        {t.status === "CLOSED" ? "Resolved" : t.waitingOnTeam ? "Waiting on the team" : "Open"} · {t.assigneeName ?? "Unassigned"}
      </span>
    </button>
  );
}

export function ConciergeInbox({
  initial,
  loadError,
  initialView,
  initialStatus,
  initialThreadId,
}: {
  initial: { threads: InboxThreadRow[]; counts: InboxCounts; canReply: boolean } | null;
  loadError: string | null;
  initialView: InboxAssigneeFilter;
  initialStatus: InboxStatusFilter;
  initialThreadId: string | null;
}) {
  const canReply = initial?.canReply ?? false;
  const [view, setView] = React.useState(initialView);
  const [status, setStatus] = React.useState(initialStatus);
  const [threads, setThreads] = React.useState<InboxThreadRow[]>(initial?.threads ?? []);
  const [counts, setCounts] = React.useState<InboxCounts>(initial?.counts ?? EMPTY_COUNTS);
  const [listError, setListError] = React.useState(loadError);
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(initialThreadId);
  const [detail, setDetail] = React.useState<InboxThreadDetail | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [assignees, setAssignees] = React.useState<AssigneeOption[] | null>(null);
  const selected = React.useRef<string | null>(initialThreadId);

  const loadList = React.useCallback(async (v: InboxAssigneeFilter, s: InboxStatusFilter) => {
    const res = await listConciergeThreads({ assignee: v, status: s });
    if (res.success) {
      setThreads(res.data.threads);
      setCounts(res.data.counts);
      setListError(null);
    } else {
      setListError(res.error);
    }
  }, []);

  const loadDetail = React.useCallback(async (id: string) => {
    const visible = document.visibilityState === "visible";
    const res = await getConciergeThread(id, { markRead: visible });
    if (selected.current !== id) return; // the user moved on to another conversation
    if (res.success) {
      setDetail(res.data);
      setDetailError(null);
      if (visible) setThreads((list) => list.map((row) => (row.id === id ? { ...row, unread: 0 } : row)));
    } else {
      setDetailError(res.error);
    }
  }, []);

  React.useEffect(() => {
    if (initialThreadId) void loadDetail(initialThreadId);
  }, [initialThreadId, loadDetail]);

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

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadList(view, status);
    }, LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadList, view, status]);

  React.useEffect(() => {
    if (!selectedId) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadDetail(selectedId);
    };
    const timer = window.setInterval(refresh, DETAIL_POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [selectedId, loadDetail]);

  function select(id: string) {
    if (id === selected.current) return;
    selected.current = id;
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    writeUrl({ thread: id });
    void loadDetail(id);
  }

  function back() {
    selected.current = null;
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    writeUrl({ thread: null });
  }

  function changeView(v: InboxAssigneeFilter) {
    setView(v);
    writeUrl({ view: v });
    void loadList(v, status);
  }

  function changeStatus(s: InboxStatusFilter) {
    setStatus(s);
    writeUrl({ status: s });
    void loadList(view, s);
  }

  const onChanged = React.useCallback(async () => {
    const id = selected.current;
    await Promise.all([id ? loadDetail(id) : Promise.resolve(), loadList(view, status)]);
  }, [loadDetail, loadList, view, status]);

  const q = query.trim().toLowerCase();
  const shown = q
    ? threads.filter((t) =>
        [t.contactName, t.bookingNumber, t.eventName, t.assigneeName, t.lastMessage?.excerpt].some((v) => v?.toLowerCase().includes(q))
      )
    : threads;

  return (
    <div className="grid h-[calc(100dvh-15rem)] min-h-[560px] overflow-hidden rounded-2xl border bg-card shadow-card md:grid-cols-[minmax(280px,360px)_1fr]">
      <aside className={cn("min-h-0 flex-col border-r", selectedId ? "hidden md:flex" : "flex")}>
        <div className="space-y-2 border-b p-3">
          <SegmentedControl<InboxAssigneeFilter>
            ariaLabel="Whose conversations"
            size="sm"
            value={view}
            onChange={changeView}
            className="w-full"
            options={[
              { value: "mine", label: `Mine · ${counts.mineOpen}` },
              { value: "unassigned", label: `Unassigned · ${counts.unassignedOpen}` },
              { value: "all", label: `All · ${counts.allOpen}` },
            ]}
          />
          <SegmentedControl<InboxStatusFilter>
            ariaLabel="Conversation status"
            size="sm"
            value={status}
            onChange={changeStatus}
            className="w-full"
            options={[
              { value: "OPEN", label: "Open" },
              { value: "CLOSED", label: "Resolved" },
              { value: "ALL", label: "All" },
            ]}
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, booking or message"
              aria-label="Search conversations"
              className="h-8 pl-8 text-sm"
            />
          </div>
          {counts.unreadConversations > 0 && (
            <p className="text-xs text-muted-foreground">
              {counts.unreadConversations} conversation{counts.unreadConversations === 1 ? "" : "s"} with customer messages nobody has opened
            </p>
          )}
        </div>
        {listError && <p className="border-b bg-destructive/10 px-3 py-2 text-xs text-destructive">{listError}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
              <Inbox className="size-6" />
              {q ? "No conversations match your search." : "No conversations here. When a customer writes from the app, it shows up in this list."}
            </div>
          ) : (
            shown.map((t) => <ThreadRowButton key={t.id} t={t} selected={t.id === selectedId} onSelect={select} />)
          )}
        </div>
      </aside>

      <section className={cn("min-h-0 flex-col", selectedId ? "flex" : "hidden md:flex")}>
        {!selectedId ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <MessagesSquare className="size-6" />
            Choose a conversation to read and reply.
          </div>
        ) : detail ? (
          <ConciergeThreadView
            detail={detail}
            reach={detail.reach}
            canReply={canReply}
            assignees={canReply ? assignees : null}
            onChanged={onChanged}
            onBack={back}
            syncError={detailError}
          />
        ) : detailError ? (
          <div className="flex flex-col items-start gap-3 p-6 text-sm text-destructive">
            <Button variant="ghost" size="sm" onClick={back} className="md:hidden">
              <ArrowLeft className="size-4" /> Conversations
            </Button>
            {detailError}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading conversation…
          </div>
        )}
      </section>
    </div>
  );
}
