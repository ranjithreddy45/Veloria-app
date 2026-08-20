import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { MessageSquareText } from "lucide-react";
import { listChannels, listChatUsers } from "@/actions/chat.actions";
import { ChatClient } from "./_components/chat-client";

export const metadata: Metadata = { title: "Team Chat" };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const [channelsRes, usersRes] = await Promise.all([listChannels(), listChatUsers()]);

  if (!channelsRes.success) {
    return (
      <div className="space-y-6">
        <PageHeader icon={MessageSquareText} accent="pink" title="Team Chat" description="" />
        <p className="text-sm text-muted-foreground">{channelsRes.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={MessageSquareText}
        accent="pink"
        eyebrow="Team"
        title="Team Chat"
        description="Message teammates one-to-one or in channels."
      />
      <ChatClient
        initialChannels={channelsRes.data}
        users={usersRes.success ? usersRes.data : []}
      />
    </div>
  );
}
