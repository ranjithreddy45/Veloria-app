import type { Metadata } from "next";
import {
  getConversationsList,
  getWhatsAppStats,
} from "@/actions/whatsapp.actions";
import { WhatsAppInbox } from "./_components/whatsapp-inbox";

export const metadata: Metadata = { title: "WhatsApp" };

// ============================================================
// WhatsApp Inbox Page
// ============================================================

export default async function WhatsAppPage() {
  const [conversationsResult, statsResult] = await Promise.all([
    getConversationsList(),
    getWhatsAppStats(),
  ]);

  const conversations = conversationsResult.success
    ? (conversationsResult.data ?? [])
    : [];
  const stats = statsResult.success ? (statsResult.data ?? null) : null;

  return <WhatsAppInbox initialConversations={conversations} initialStats={stats} />;
}
