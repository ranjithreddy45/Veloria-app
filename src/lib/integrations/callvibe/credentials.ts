import { prisma } from "@/lib/prisma";
import type { CallVibeCreds } from "@/lib/integrations/callvibe";

// ============================================================
// The saved CallVibe account, for the write side. Same record and the same
// "newest active config wins" rule the import uses — there is no second
// credentials form. Server-only: the password must never reach a client.
// ============================================================

export interface ActiveCallVibeConfig {
  id: string;
  creds: CallVibeCreds;
  pushEnabled: boolean;
  pushDefaultAssignee: string | null;
  pushCallingList: string | null;
}

export async function getActiveCallVibeConfig(): Promise<ActiveCallVibeConfig | null> {
  const config = await prisma.callVibeConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!config) return null;
  return {
    id: config.id,
    creds: { baseUrl: config.baseUrl, email: config.email, password: config.password },
    pushEnabled: config.pushEnabled,
    pushDefaultAssignee: config.pushDefaultAssignee?.trim() || null,
    pushCallingList: config.pushCallingList?.trim() || null,
  };
}
