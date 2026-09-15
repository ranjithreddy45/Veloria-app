// ============================================================
// Web Push sender — fans one payload out to every device a user has
// subscribed. Server-only (web-push needs Node crypto/https).
//
// Contract:
//   - Safe when keys are missing: no-op after ONE console.warn.
//   - NEVER throws. Callers are fire-and-forget hooks (notify()) and must not
//     be broken by a push failure.
//   - Dead endpoints (404/410 from the push service) are deleted so we stop
//     paying for them.
// ============================================================

import * as webPush from "web-push";
import { prisma } from "@/lib/prisma";
import { describeMissingVapid, getVapidConfig, type VapidConfig } from "./vapid";

export interface PushPayload {
  title: string;
  body: string;
  /** Same-origin path ("/tasks/abc") or absolute URL opened on click. */
  url?: string | null;
  /** Notifications sharing a tag collapse into one (e.g. per booking). */
  tag?: string;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  /** Subscriptions deleted because the push service said they are gone. */
  removed: number;
  /** True when push is not configured (nothing attempted). */
  skipped: boolean;
}

/** Push services reject payloads over ~4KB; keep well under with headroom. */
const MAX_TITLE = 80;
const MAX_BODY = 240;
/** Deliver within a day, then the push service drops it. */
const TTL_SECONDS = 60 * 60 * 24;
/** Bound each request so an awaited fan-out can't stall a cron/webhook. */
const REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_URL = "/notifications";

const SKIPPED: PushSendResult = { sent: 0, failed: 0, removed: 0, skipped: true };

let warnedMissingKeys = false;

function getConfigOrWarn(): VapidConfig | null {
  const cfg = getVapidConfig();
  if (cfg) return cfg;
  if (!warnedMissingKeys) {
    warnedMissingKeys = true;
    console.warn(
      `[PUSH] Web push disabled — missing/invalid env: ${describeMissingVapid().join(", ")}. ` +
        "Generate keys with `npx tsx scripts/generate-vapid-keys.ts`."
    );
  }
  return null;
}

function truncate(value: string, max: number): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function buildPayload(payload: PushPayload): string {
  return JSON.stringify({
    title: truncate(payload.title || "Veloria Grand", MAX_TITLE),
    body: truncate(payload.body || "", MAX_BODY),
    url: payload.url || DEFAULT_URL,
    ...(payload.tag ? { tag: payload.tag } : {}),
  });
}

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type Outcome = "sent" | "removed" | "failed";

async function sendToSubscription(
  sub: StoredSubscription,
  body: string,
  vapid: VapidConfig
): Promise<Outcome> {
  try {
    await webPush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      body,
      {
        vapidDetails: vapid,
        TTL: TTL_SECONDS,
        timeout: REQUEST_TIMEOUT_MS,
        urgency: "normal",
      }
    );
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number } | null)?.statusCode;
    if (status === 404 || status === 410) {
      // Endpoint expired or the user revoked it at the browser — prune.
      await prisma.pushSubscription
        .delete({ where: { id: sub.id } })
        .catch(() => undefined);
      return "removed";
    }
    if (status === 401 || status === 403) {
      // Almost always a VAPID key rotation: the device subscribed under the old
      // public key. The device must re-enable; the client re-subscribes when it
      // notices the key mismatch (see lib/push/client.ts).
      console.error(
        `[PUSH] rejected (${status}) — VAPID key mismatch? endpoint=${sub.endpoint.slice(0, 60)}…`
      );
      return "failed";
    }
    console.error("[PUSH] send failed", {
      status,
      endpoint: sub.endpoint.slice(0, 60),
      message: err instanceof Error ? err.message : String(err),
    });
    return "failed";
  }
}

function tally(outcomes: Outcome[]): PushSendResult {
  const result: PushSendResult = { sent: 0, failed: 0, removed: 0, skipped: false };
  for (const outcome of outcomes) result[outcome] += 1;
  return result;
}

/**
 * Send one push to every subscription the user has. Never throws.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<PushSendResult> {
  try {
    const vapid = getConfigOrWarn();
    if (!vapid) return { ...SKIPPED };
    if (!userId) return { sent: 0, failed: 0, removed: 0, skipped: false };

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0, removed: 0, skipped: false };
    }

    const body = buildPayload(payload);
    const outcomes = await Promise.all(
      subscriptions.map((sub) => sendToSubscription(sub, body, vapid))
    );
    return tally(outcomes);
  } catch (err) {
    console.error("[PUSH] fan-out failed", err);
    return { sent: 0, failed: 0, removed: 0, skipped: false };
  }
}

/**
 * Same payload to many users (e.g. all admins). Never throws.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<PushSendResult> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const results = await Promise.all(unique.map((id) => sendPushToUser(id, payload)));
  return results.reduce<PushSendResult>(
    (acc, r) => ({
      sent: acc.sent + r.sent,
      failed: acc.failed + r.failed,
      removed: acc.removed + r.removed,
      skipped: acc.skipped && r.skipped,
    }),
    { sent: 0, failed: 0, removed: 0, skipped: results.length > 0 }
  );
}
