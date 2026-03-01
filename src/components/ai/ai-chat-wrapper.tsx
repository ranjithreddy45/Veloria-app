"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { AIChatPanel } from "./ai-chat-panel";

export function AIChatWrapper() {
  const { permissions } = usePermissions();
  if (!permissions.includes("ai:use")) return null;
  return <AIChatPanel />;
}
