"use client";

import dynamic from "next/dynamic";
import { usePermissions } from "@/hooks/use-permissions";

// Load the chat panel (which pulls in recharts + markdown rendering, ~250KB)
// only when a permitted user actually mounts it. This keeps recharts out of
// the shared dashboard layout chunk that every page would otherwise download.
const AIChatPanel = dynamic(
  () => import("./ai-chat-panel").then((m) => m.AIChatPanel),
  { ssr: false }
);

export function AIChatWrapper() {
  const { permissions } = usePermissions();
  if (!permissions.includes("ai:use")) return null;
  return <AIChatPanel />;
}
