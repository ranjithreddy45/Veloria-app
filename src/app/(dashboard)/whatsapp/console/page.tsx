import type { Metadata } from "next";
import { getConversationsList } from "@/actions/whatsapp.actions";
import { ConsoleClient } from "../_components/console-client";

export const metadata: Metadata = { title: "WhatsApp Console" };

// ============================================================
// WhatsApp Console Page — internal, gated whatsapp:read.
// ------------------------------------------------------------
// The /whatsapp prefix in ROUTE_PERMISSIONS already maps to whatsapp:read, so
// no new route-permission entry is required. Additive route: the live
// /whatsapp inbox page.tsx is untouched. Reuses getConversationsList for the
// list rail; the client mounts the existing InboxChatView plus the new
// SessionWindowBadge + CopilotPanel.
// ============================================================

export default async function WhatsAppConsolePage() {
  const conversationsResult = await getConversationsList();
  const conversations = conversationsResult.success
    ? (conversationsResult.data ?? [])
    : [];

  return <ConsoleClient initialConversations={conversations} />;
}
