"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { Search, Plus, Send, Users, MessageSquarePlus, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  listChannels,
  getChatMessages,
  sendChatMessage,
  getOrCreateDirectChannel,
  createGroupChannel,
  type ChannelSummary,
  type ChatMessageDto,
  type ChatUserLite,
} from "@/actions/chat.actions";

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
const COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
];
function color(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

interface Thread {
  title: string;
  type: "DIRECT" | "GROUP";
  memberCount: number;
  messages: ChatMessageDto[];
}

export function ChatClient({
  initialChannels,
  users,
}: {
  initialChannels: ChannelSummary[];
  users: ChatUserLite[];
}) {
  const sp = useSearchParams();
  const [channels, setChannels] = React.useState<ChannelSummary[]>(initialChannels);
  const [selectedId, setSelectedId] = React.useState<string | null>(sp.get("c"));
  const [thread, setThread] = React.useState<Thread | null>(null);
  const [loadingThread, setLoadingThread] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [showChatOnMobile, setShowChatOnMobile] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  // New-chat dialog
  const [newOpen, setNewOpen] = React.useState(false);
  const [newMode, setNewMode] = React.useState<"dm" | "group">("dm");
  const [userSearch, setUserSearch] = React.useState("");
  const [groupName, setGroupName] = React.useState("");
  const [groupMembers, setGroupMembers] = React.useState<Set<string>>(new Set());

  const refreshChannels = React.useCallback(async () => {
    const res = await listChannels();
    if (res.success) setChannels(res.data);
  }, []);

  const loadThread = React.useCallback(async (id: string, showSpinner = false) => {
    if (showSpinner) setLoadingThread(true);
    const res = await getChatMessages(id);
    if (res.success) setThread(res.data);
    else if (showSpinner) toast.error(res.error);
    if (showSpinner) setLoadingThread(false);
  }, []);

  function selectChannel(id: string) {
    setShowChatOnMobile(true);
    setThread(null);
    // The [selectedId] effect loads the thread — don't also load here (double fetch).
    setSelectedId(id);
    // Optimistically clear the unread badge.
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  // Load thread when selection changes (also handles the ?c= deep link).
  React.useEffect(() => {
    if (selectedId) loadThread(selectedId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Poll the channel list + the open thread.
  React.useEffect(() => {
    const a = setInterval(refreshChannels, 8000);
    return () => clearInterval(a);
  }, [refreshChannels]);
  React.useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(() => loadThread(selectedId), 4000);
    return () => clearInterval(t);
  }, [selectedId, loadThread]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || !selectedId) return;
    const chan = selectedId;
    setSending(true);
    setDraft("");
    // Optimistic: show my message immediately, then reconcile with the server.
    const optimistic: ChatMessageDto = {
      id: `tmp-${Date.now()}`,
      body: text,
      createdAt: new Date().toISOString(),
      senderId: "__me__",
      senderName: "You",
      mine: true,
    };
    setThread((t) => (t ? { ...t, messages: [...t.messages, optimistic] } : t));
    try {
      const res = await sendChatMessage(chan, text);
      if (!res.success) {
        toast.error(res.error);
        setDraft(text); // restore so the message isn't lost
      }
      await loadThread(chan);
      refreshChannels();
    } finally {
      setSending(false);
    }
  }

  async function startDm(userId: string) {
    const res = await getOrCreateDirectChannel(userId);
    if (res.success) {
      setNewOpen(false);
      await refreshChannels();
      selectChannel(res.data.id);
    } else {
      toast.error(res.error);
    }
  }

  async function makeGroup() {
    if (!groupName.trim()) {
      toast.error("Name your channel");
      return;
    }
    const res = await createGroupChannel(groupName.trim(), Array.from(groupMembers));
    if (res.success) {
      setNewOpen(false);
      setGroupName("");
      setGroupMembers(new Set());
      await refreshChannels();
      selectChannel(res.data.id);
    } else {
      toast.error(res.error);
    }
  }

  const filteredChannels = channels.filter((c) =>
    !search ? true : c.displayName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredUsers = users.filter((u) =>
    !userSearch
      ? true
      : (u.name || u.email).toLowerCase().includes(userSearch.toLowerCase())
  );

  // Render helpers (NOT components used as <X/>): defining them as nested
  // components and rendering <ThreadView/> gave them a new identity every
  // render, so React remounted the whole subtree on each keystroke/poll and the
  // composer lost focus. Calling them as functions keeps the DOM stable.
  function renderRail() {
    return (
      <div className="flex h-full min-h-0 flex-col border-r">
        <div className="flex items-center justify-between gap-2 p-3 pb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button size="icon" variant="outline" onClick={() => setNewOpen(true)} aria-label="New chat">
            <Plus className="size-4" />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {filteredChannels.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <MessageSquarePlus className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No chats yet.</p>
              <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
                Start a chat
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filteredChannels.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectChannel(c.id)}
                  className={cn(
                    "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50",
                    selectedId === c.id && "bg-violet-50/60 dark:bg-violet-950/20 border-l-2 border-violet-600"
                  )}
                >
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback className={cn("text-xs font-medium", color(c.avatarName))}>
                      {c.type === "GROUP" ? <Users className="size-4" /> : initials(c.avatarName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-sm", c.unread > 0 ? "font-semibold" : "font-medium")}>
                        {c.displayName}
                      </p>
                      {c.lastMessageAt && (
                        <span className="shrink-0 text-meta text-muted-foreground">
                          {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-xs", c.unread > 0 ? "text-foreground/80" : "text-muted-foreground")}>
                        {c.lastSenderIsMe && <span className="mr-1">You:</span>}
                        {c.lastMessage || (c.type === "GROUP" ? `${c.memberCount} members` : "Say hello")}
                      </p>
                      {c.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  function renderThread() {
    if (!selectedId) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <MessageSquarePlus className="size-10 text-muted-foreground/40" />
          <p className="max-w-xs text-sm text-muted-foreground">
            Select a chat, or start a new one to message your team.
          </p>
        </div>
      );
    }
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={() => setShowChatOnMobile(false)}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className={cn("text-xs font-medium", color(thread?.title || "?"))}>
              {thread?.type === "GROUP" ? <Users className="size-4" /> : initials(thread?.title || "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{thread?.title || "…"}</p>
            {thread?.type === "GROUP" && (
              <p className="text-xs text-muted-foreground">{thread.memberCount} members</p>
            )}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 bg-muted/20">
          <div className="mx-auto max-w-3xl space-y-2 p-4">
            {loadingThread && !thread ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : thread && thread.messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No messages yet. Say hello 👋
              </p>
            ) : (
              thread?.messages.map((m) => (
                <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3 py-2 shadow-sm",
                      m.mine
                        ? "bg-violet-600 text-white"
                        : "bg-card text-foreground"
                    )}
                  >
                    {!m.mine && thread?.type === "GROUP" && (
                      <p className="mb-0.5 text-[11px] font-semibold opacity-80">{m.senderName}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
                    <div
                      className={cn(
                        "mt-0.5 text-right text-[10px]",
                        m.mine ? "text-violet-200" : "text-muted-foreground"
                      )}
                    >
                      {format(new Date(m.createdAt), "HH:mm")}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t bg-background p-3">
          <div className="flex gap-2">
            <Textarea
              placeholder="Type a message… (Enter to send)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              className="max-h-[120px] min-h-[40px] resize-none"
              rows={1}
            />
            <Button
              onClick={send}
              disabled={!draft.trim() || sending}
              size="icon"
              className="shrink-0 bg-violet-600 hover:bg-violet-700"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="h-[calc(100vh-240px)] min-h-[520px] overflow-hidden">
          <div className="hidden h-full min-h-0 md:flex">
            <div className="w-[340px] shrink-0 min-h-0 overflow-hidden">
              {renderRail()}
            </div>
            <div className="min-w-0 min-h-0 flex-1 overflow-hidden">
              {renderThread()}
            </div>
          </div>
          <div className="h-full min-h-0 overflow-hidden md:hidden">
            {showChatOnMobile && selectedId ? renderThread() : renderRail()}
          </div>
        </div>
      </Card>

      {/* New chat dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New chat</DialogTitle>
          </DialogHeader>
          <div className="mb-2 flex gap-1">
            <Button
              size="sm"
              variant={newMode === "dm" ? "default" : "ghost"}
              onClick={() => setNewMode("dm")}
              className={cn("h-8", newMode === "dm" && "bg-violet-600 hover:bg-violet-700")}
            >
              Direct message
            </Button>
            <Button
              size="sm"
              variant={newMode === "group" ? "default" : "ghost"}
              onClick={() => setNewMode("group")}
              className={cn("h-8", newMode === "group" && "bg-violet-600 hover:bg-violet-700")}
            >
              New channel
            </Button>
          </div>

          {newMode === "group" && (
            <div className="mb-2 space-y-1.5">
              <Label htmlFor="grp">Channel name</Label>
              <Input
                id="grp"
                placeholder="e.g. Sales floor"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search teammates…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="mt-2 h-[280px] rounded-lg border">
            <div className="divide-y">
              {filteredUsers.map((u) => {
                const label = u.name || u.email;
                const checked = groupMembers.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      if (newMode === "dm") {
                        startDm(u.id);
                      } else {
                        setGroupMembers((prev) => {
                          const next = new Set(prev);
                          if (next.has(u.id)) next.delete(u.id);
                          else next.add(u.id);
                          return next;
                        });
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 p-2.5 text-left hover:bg-muted/50",
                      checked && "bg-violet-50/60 dark:bg-violet-950/20"
                    )}
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className={cn("text-[11px] font-medium", color(label))}>
                        {initials(label)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{label}</p>
                      <p className="truncate text-meta text-muted-foreground">{u.role.replace(/_/g, " ")}</p>
                    </div>
                    {newMode === "group" && checked && (
                      <span className="text-xs font-medium text-violet-600">✓</span>
                    )}
                  </button>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">No teammates found.</p>
              )}
            </div>
          </ScrollArea>

          {newMode === "group" && (
            <DialogFooter>
              <span className="mr-auto self-center text-xs text-muted-foreground">
                {groupMembers.size} selected
              </span>
              <Button
                onClick={makeGroup}
                disabled={!groupName.trim()}
                className="bg-violet-600 hover:bg-violet-700"
              >
                Create channel
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
