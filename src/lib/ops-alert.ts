import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";

// ============================================================
// Ops alerting — turn silent failures into surfaced ones.
//
// Anywhere an automated side-effect can fail quietly (a cron job, a GL post,
// a webhook), call reportSystemFailure() so the people who can act find out
// in-app within minutes instead of discovering it days later in the logs.
//
// Awaitable + best-effort: it never throws, so it's safe to call from a catch
// block without masking the original error.
// ============================================================

let cachedAdminIds: { ids: string[]; at: number } | null = null;
const ADMIN_CACHE_MS = 60_000; // re-query at most once a minute

async function getAdminIds(): Promise<string[]> {
  const now = Date.now();
  if (cachedAdminIds && now - cachedAdminIds.at < ADMIN_CACHE_MS) {
    return cachedAdminIds.ids;
  }
  try {
    const admins = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      select: { id: true },
    });
    const ids = admins.map((a) => a.id);
    cachedAdminIds = { ids, at: now };
    return ids;
  } catch (e) {
    console.error("[OPS_ALERT_ADMIN_LOOKUP_ERROR]", e);
    return cachedAdminIds?.ids ?? [];
  }
}

export interface SystemFailureAlert {
  /** Short area tag, e.g. "Cron", "GL posting", "Webhook". */
  area: string;
  /** One-line human title for the notification. */
  title: string;
  /** Details (job names, ids, error message). */
  detail: string;
  /** Optional deep link to where the issue can be inspected. */
  actionUrl?: string;
}

/**
 * Surface an automated-system failure to every active admin (SYSTEM
 * notification) and log it. Best-effort + awaitable — safe inside a catch.
 */
export async function reportSystemFailure(alert: SystemFailureAlert): Promise<void> {
  try {
    console.error(`[SYSTEM_FAILURE] ${alert.area}: ${alert.title} — ${alert.detail}`);
    const adminIds = await getAdminIds();
    await Promise.all(
      adminIds.map((userId) =>
        notifyAwait({
          userId,
          type: "SYSTEM",
          title: `⚠️ ${alert.area}: ${alert.title}`,
          message: alert.detail,
          actionUrl: alert.actionUrl,
        })
      )
    );
  } catch (e) {
    // Never let the alerter itself throw into a catch block.
    console.error("[OPS_ALERT_ERROR]", e);
  }
}
