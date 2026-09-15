"use server";

// ============================================================
// Web Push subscription actions. Every action gates on the signed-in user and
// only ever touches THAT user's device rows — a caller can't enumerate or
// remove someone else's subscriptions.
// ============================================================

import { z } from "zod";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push/vapid";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const UNAUTHORIZED: ActionResult<never> = { success: false, error: "Unauthorized" };

const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .min(1)
    .max(2048)
    .refine((v) => v.startsWith("https://"), "Push endpoint must be https"),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
  userAgent: z.string().max(512).optional(),
});

export type PushSubscriptionInput = z.infer<typeof subscriptionSchema>;

// ============================================================
// getPushPublicKey
// ============================================================

/**
 * The VAPID public key the browser subscribes with, plus whether the server
 * side is fully configured (private key + subject too). Read at request time
 * so a key set only in the runtime env (VPS) still reaches the client.
 */
export async function getPushPublicKey(): Promise<
  ActionResult<{ publicKey: string | null; configured: boolean }>
> {
  const session = await auth();
  if (!session?.user?.id) return UNAUTHORIZED;
  return {
    success: true,
    data: { publicKey: getVapidPublicKey(), configured: isPushConfigured() },
  };
}

// ============================================================
// savePushSubscription
// ============================================================

/**
 * Upsert on endpoint. A browser endpoint belongs to whoever is signed in on
 * that device NOW — if a different user subscribed here earlier, the row is
 * reassigned rather than duplicated, so nobody receives another person's
 * alerts on a shared machine.
 */
export async function savePushSubscription(
  input: PushSubscriptionInput
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.id) return UNAUTHORIZED;

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid push subscription" };
  }
  const { endpoint, keys, userAgent } = parsed.data;

  try {
    const row = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? null,
      },
      update: {
        userId: session.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? null,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });
    return { success: true, data: { id: row.id } };
  } catch (err) {
    console.error("[PUSH] savePushSubscription failed", err);
    return {
      success: false,
      error: "Couldn't register this device for notifications",
    };
  }
}

// ============================================================
// removePushSubscription
// ============================================================

/** Forget an endpoint — scoped to the caller's own rows. Idempotent. */
export async function removePushSubscription(
  endpoint: string
): Promise<ActionResult<{ removed: number }>> {
  const session = await auth();
  if (!session?.user?.id) return UNAUTHORIZED;
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return { success: false, error: "Missing endpoint" };
  }

  try {
    const { count } = await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.user.id },
    });
    return { success: true, data: { removed: count } };
  } catch (err) {
    console.error("[PUSH] removePushSubscription failed", err);
    return { success: false, error: "Couldn't remove this device" };
  }
}

// ============================================================
// hasPushSubscription
// ============================================================

/**
 * Does the server hold this endpoint for the signed-in user? Lets the toggle
 * show the truth rather than trusting the browser alone (the row may belong
 * to a previous user of this browser, or have been pruned as dead).
 */
export async function hasPushSubscription(
  endpoint: string
): Promise<ActionResult<{ subscribed: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) return UNAUTHORIZED;
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return { success: true, data: { subscribed: false } };
  }

  try {
    const row = await prisma.pushSubscription.findFirst({
      where: { endpoint, userId: session.user.id },
      select: { id: true },
    });
    if (row) {
      // Cheap heartbeat so stale-device cleanup has something to go on later.
      await prisma.pushSubscription
        .update({ where: { id: row.id }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }
    return { success: true, data: { subscribed: Boolean(row) } };
  } catch (err) {
    console.error("[PUSH] hasPushSubscription failed", err);
    return { success: true, data: { subscribed: false } };
  }
}
