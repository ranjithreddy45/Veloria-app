"use client";

import { useState } from "react";
import { Search, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { ConversationSummary } from "@/actions/whatsapp.actions";

// ============================================================
// Conversation List — Left panel of the WhatsApp inbox (Weflux-style).
// ============================================================

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedContactId: string | null;
  onSelect: (contactId: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Weflux gives each contact a coloured avatar; mirror that with a stable
// per-name colour so the list reads the same at a glance.
const AVATAR_COLORS = [
  "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

type Tab = "all" | "unreplied";

export function ConversationList({
  conversations,
  selectedContactId,
  onSelect,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  // "Unreplied" = the customer sent the last message (mirrors Weflux's tab).
  const unrepliedCount = conversations.filter((c) => c.lastDirection === "INBOUND").length;

  const filtered = conversations.filter((c) => {
    if (tab === "unreplied" && c.lastDirection !== "INBOUND") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.contactName.toLowerCase().includes(q) || c.contactPhone.includes(q);
  });

  return (
    <div className="flex h-full flex-col border-r">
      {/* Header: title + count */}
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">Inbox</h2>
          <span className="text-meta text-muted-foreground">
            {conversations.length} {conversations.length === 1 ? "chat" : "chats"}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filter tabs — All / Unreplied (Weflux-style) */}
      <div className="flex items-center gap-1 border-b px-3 pb-2 text-[13px]">
        {([
          { key: "all", label: "All", count: conversations.length },
          { key: "unreplied", label: "Unreplied", count: unrepliedCount },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-2 py-1 font-medium transition-colors",
              tab === t.key
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={cn(
                  "ml-1 rounded px-1 text-[11px] font-semibold",
                  t.key === "unreplied" && t.count > 0
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300"
                    : "text-muted-foreground"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <MessageCircle className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search
                ? "No conversations match your search"
                : tab === "unreplied"
                  ? "No unreplied conversations — you're all caught up."
                  : "No conversations yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((conv) => {
              const needsReply =
                conv.lastDirection === "INBOUND" && selectedContactId !== conv.contactId;
              const waitingFor =
                conv.lastDirection === "INBOUND" && conv.lastMessageAt
                  ? formatDistanceToNow(new Date(conv.lastMessageAt))
                  : null;
              return (
                <button
                  key={conv.contactId}
                  onClick={() => onSelect(conv.contactId)}
                  aria-label={needsReply ? `${conv.contactName}, awaiting reply` : conv.contactName}
                  className={cn(
                    "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50",
                    needsReply && "bg-emerald-50/40 dark:bg-emerald-950/10",
                    selectedContactId === conv.contactId &&
                      "bg-emerald-50/60 dark:bg-emerald-950/20 border-l-2 border-emerald-600"
                  )}
                >
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback
                      className={cn("text-xs font-medium", avatarColor(conv.contactName))}
                    >
                      {getInitials(conv.contactName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {needsReply && (
                          <span aria-hidden className="size-2 shrink-0 rounded-full bg-emerald-600" />
                        )}
                        <p
                          className={cn(
                            "truncate text-sm text-foreground",
                            needsReply ? "font-semibold" : "font-medium"
                          )}
                        >
                          {conv.contactName}
                        </p>
                      </div>
                      {conv.lastMessageAt && (
                        <span
                          className={cn(
                            "shrink-0 text-meta",
                            needsReply
                              ? "font-medium text-emerald-700 dark:text-emerald-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        "truncate text-xs",
                        needsReply ? "text-foreground/80" : "text-muted-foreground"
                      )}
                    >
                      {conv.lastDirection === "OUTBOUND" && <span className="mr-1">You:</span>}
                      {conv.lastMessage || "No messages"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="truncate text-meta text-muted-foreground/70">
                        {conv.contactPhone}
                      </p>
                      {waitingFor && (
                        <span className="shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                          Waiting {waitingFor}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
