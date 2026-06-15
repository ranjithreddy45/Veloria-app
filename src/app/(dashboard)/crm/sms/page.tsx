import type { Metadata } from "next";
import { getSmsMessages, getSmsStats } from "@/actions/sms.actions";
import { SmsConsole } from "./_components/sms-console";

export const metadata: Metadata = { title: "SMS" };

// ============================================================
// SMS Console Page
// ============================================================

export default async function SmsPage() {
  const [messagesResult, statsResult] = await Promise.all([
    getSmsMessages(),
    getSmsStats(),
  ]);

  const messages = messagesResult.success ? (messagesResult.data ?? []) : [];
  const stats = statsResult.success ? (statsResult.data ?? null) : null;

  return <SmsConsole initialMessages={messages} initialStats={stats} />;
}
