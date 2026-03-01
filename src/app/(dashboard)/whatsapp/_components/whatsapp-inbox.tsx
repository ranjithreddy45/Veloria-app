"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { WhatsAppStats } from "./whatsapp-stats";
import { ConversationList } from "./conversation-list";
import { InboxChatView } from "./inbox-chat-view";
import { WhatsAppEmptyState } from "./whatsapp-empty-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  getConversationsList,
  type ConversationSummary,
  type WhatsAppStatsData,
} from "@/actions/whatsapp.actions";

// ============================================================
// WhatsApp Inbox — Main Container
// ============================================================

interface WhatsAppInboxProps {
  initialConversations: ConversationSummary[];
  initialStats: WhatsAppStatsData | null;
}

export function WhatsAppInbox({
  initialConversations,
  initialStats,
}: WhatsAppInboxProps) {
  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  // Find the selected conversation
  const selectedConversation = conversations.find(
    (c) => c.contactId === selectedContactId
  );

  // Refresh conversations list
  const refreshConversations = useCallback(async () => {
    const result = await getConversationsList();
    if (result.success && result.data) {
      setConversations(result.data);
    }
  }, []);

  // Poll conversations every 15s
  useEffect(() => {
    const interval = setInterval(refreshConversations, 15000);
    return () => clearInterval(interval);
  }, [refreshConversations]);

  // Handle conversation selection
  function handleSelect(contactId: string) {
    setSelectedContactId(contactId);
    setShowChat(true);
  }

  // Handle back (mobile)
  function handleBack() {
    setShowChat(false);
    setSelectedContactId(null);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp"
        description="Manage WhatsApp conversations with your contacts."
      />

      {/* Stats */}
      <WhatsAppStats stats={initialStats} />

      {/* Inbox Panel */}
      <Card className="overflow-hidden">
        <div className="h-[calc(100vh-320px)] min-h-[500px]">
          {/* Desktop: side-by-side */}
          <div className="hidden h-full md:grid md:grid-cols-[360px_1fr]">
            <ConversationList
              conversations={conversations}
              selectedContactId={selectedContactId}
              onSelect={handleSelect}
            />
            {selectedConversation ? (
              <InboxChatView conversation={selectedConversation} />
            ) : (
              <WhatsAppEmptyState />
            )}
          </div>

          {/* Mobile: stacked */}
          <div className="h-full md:hidden">
            {showChat && selectedConversation ? (
              <InboxChatView
                conversation={selectedConversation}
                onBack={handleBack}
              />
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
