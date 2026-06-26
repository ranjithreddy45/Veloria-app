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
// Conversation List — Left panel of WhatsApp Inbox
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

export function ConversationList({
  conversations,
  selectedContactId,
  onSelect,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.contactName.toLowerCase().includes(q) ||
      c.contactPhone.includes(q)
    );
  });

  return (
    <div className="flex h-full flex-col border-r">
      {/* Search */}
      <div className="border-b p-3">
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

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <MessageCircle className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? "No conversations match your search" : "No conversations yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((conv) => {
              // The last message coming from the customer (INBOUND) and not
              // currently open is the standard "awaiting your reply" signal.
              // We surface it visually so staff can spot conversations that
              // need attention without opening each one.
              const needsReply =
                conv.lastDirection === "INBOUND" &&
                selectedContactId !== conv.contactId;
              return (
              <button
                key={conv.contactId}
                onClick={() => onSelect(conv.contactId)}
                aria-label={
                  needsReply
                    ? `${conv.contactName}, awaiting reply`
                    : conv.contactName
                }
                className={cn(
                  "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50",
                  needsReply && "bg-emerald-50/40 dark:bg-emerald-950/10",
                  selectedContactId === conv.contactId &&
                    "bg-emerald-50/60 dark:bg-emerald-950/20 border-l-2 border-emerald-600"
                )}
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-medium dark:bg-emerald-950 dark:text-emerald-400">
                    {getInitials(conv.contactName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {needsReply && (
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full bg-emerald-600"
                        />
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
                          "shrink-0 text-[10px]",
                          needsReply
                            ? "font-medium text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatDistanceToNow(new Date(conv.lastMessageAt), {
                          addSuffix: false,
                        })}
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "truncate text-xs",
                      needsReply
                        ? "text-foreground/80"
                        : "text-muted-foreground"
                    )}
                  >
                    {conv.lastDirection === "OUTBOUND" && (
                      <span className="mr-1">You:</span>
                    )}
                    {conv.lastMessage || "No messages"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                    {conv.contactPhone} · {conv.messageCount} message
                    {conv.messageCount !== 1 ? "s" : ""}
                  </p>
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
