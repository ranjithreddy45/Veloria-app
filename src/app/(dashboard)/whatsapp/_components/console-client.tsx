"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { ConversationList } from "./conversation-list";
import { InboxChatView } from "./inbox-chat-view";
import { WhatsAppEmptyState } from "./whatsapp-empty-state";
import { CopilotPanel } from "./copilot-panel";
import {
  SessionWindowBadge,
  type SessionWindowBadgeState,
} from "./session-window-badge";
import {
  getConversationsList,
  type ConversationSummary,
} from "@/actions/whatsapp.actions";
import { getConsoleThread } from "@/actions/whatsapp-console.actions";

// ============================================================
// WhatsApp Console (client) — list rail + existing chat view + co-pilot.
// ------------------------------------------------------------
// Additive route at /whatsapp/console. Reuses ConversationList + InboxChatView
// verbatim and layers the new SessionWindowBadge (header) + CopilotPanel
// (above the composer area) on top, driven by getConsoleThread's session-window
// state. Keeps the live /whatsapp inbox untouched.
// ============================================================

interface ConsoleClientProps {
  initialConversations: ConversationSummary[];
}

export function ConsoleClient({ initialConversations }: ConsoleClientProps) {
  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null
  );
  const [showChat, setShowChat] = useState(false);
  const [sessionState, setSessionState] =
    useState<SessionWindowBadgeState | null>(null);
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);

  const selectedConversation = conversations.find(
    (c) => c.contactId === selectedContactId
  );

  const refreshConversations = useCallback(async () => {
    const result = await getConversationsList();
    if (result.success && result.data) {
      setConversations(result.data);
    }
  }, []);

  // Load the session-window state for the selected contact (drives the badge +
  // the co-pilot free-text hint). Refetched on selection + after a send.
  const loadSessionState = useCallback(async () => {
    if (!selectedContactId) {
      setSessionState(null);
      return;
    }
    const result = await getConsoleThread(selectedContactId);
    if (result.success && result.data) {
      const data = result.data as {
        sessionWindow: SessionWindowBadgeState;
      };
      setSessionState(data.sessionWindow);
    }
  }, [selectedContactId]);

  useEffect(() => {
    loadSessionState();
  }, [loadSessionState, threadRefreshKey]);

  // Keep the list rail fresh.
  useEffect(() => {
    const interval = setInterval(refreshConversations, 15000);
    return () => clearInterval(interval);
  }, [refreshConversations]);

  function handleSelect(contactId: string) {
    setSelectedContactId(contactId);
    setShowChat(true);
  }

  function handleBack() {
    setShowChat(false);
    setSelectedContactId(null);
  }

  // After a co-pilot send, refresh the thread (InboxChatView remounts via key)
  // and the session state so the badge ticks correctly.
  function handleCopilotSent() {
    setThreadRefreshKey((k) => k + 1);
    refreshConversations();
  }

  const sessionOpen = sessionState?.sessionOpen ?? false;

  function renderChat(onBack?: () => void) {
    if (!selectedConversation) return <WhatsAppEmptyState />;
    return (
      <div className="flex h-full flex-col">
        {/* Session-window badge strip above the reused chat view. */}
        <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-1.5">
          <SessionWindowBadge state={sessionState} />
        </div>
        <div className="min-h-0 flex-1">
          <InboxChatView
            key={`${selectedConversation.contactId}-${threadRefreshKey}`}
            conversation={selectedConversation}
            onBack={onBack}
          />
        </div>
        {/* Co-pilot near the composer. */}
        <div className="border-t bg-background p-3">
          <CopilotPanel
            contactId={selectedConversation.contactId}
            sessionOpen={sessionOpen}
            onSent={handleCopilotSent}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp Console"
        help={<PageHelp id="whatsapp" />}
        description="Two-way replies with an AI co-pilot and live 24h session-window tracking."
      />

      <Card className="overflow-hidden">
        <div className="h-[calc(100vh-260px)] min-h-[520px]">
          {/* Desktop: side-by-side */}
          <div className="hidden h-full md:grid md:grid-cols-[360px_1fr]">
            <ConversationList
              conversations={conversations}
              selectedContactId={selectedContactId}
              onSelect={handleSelect}
            />
            {renderChat()}
          </div>

          {/* Mobile: stacked */}
          <div className="h-full md:hidden">
            {showChat && selectedConversation ? (
              renderChat(handleBack)
            ) : (
              <ConversationList
                conversations={conversations}
                selectedContactId={selectedContactId}
                onSelect={handleSelect}
              />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
