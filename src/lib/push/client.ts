// ============================================================
// Browser-side push helpers. Plain module — only ever imported from client
// components, so it needs no "use client" directive itself. Persistence goes
// through push.actions (server actions), never a raw fetch.
// ============================================================

import {
  getPushPublicKey,
  hasPushSubscription,
  removePushSubscription,
  savePushSubscription,
} from "@/actions/push.actions";

const SW_URL = "/sw.js";
const SW_SCOPE = "/";

export type PushSupport =
  /** No service worker / PushManager / Notification API in this browser. */
  | "unsupported"
  /** Push needs a secure context (https or localhost). */
  | "insecure"
  | "supported";

export type SubscribeFailure =
  | "unsupported"
  | "insecure"
  | "not-configured"
  | "denied"
  | "failed";

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: SubscribeFailure; message: string };

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "unsupported";
  }
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  if (!window.isSecureContext) return "insecure";
  return "supported";
}

export function getPermissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/** Decode the URL-safe base64 VAPID public key into the bytes the browser wants. */
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const bytes = new Uint8Array(a);
  if (bytes.length !== b.length) return false;
  for (let i = 0; i < bytes.length; i += 1) if (bytes[i] !== b[i]) return false;
  return true;
}

/**
 * The app-level registrar only registers the SW in production; push needs it
 * in every environment, so register (idempotent) when nothing is there yet.
 * Resolves once the worker is active and controlling the page.
 */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (!existing) await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  return navigator.serviceWorker.ready;
}

/** The browser's current subscription for this origin, if any. */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() !== "supported") return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * True when this device will actually receive pushes for the signed-in user:
 * permission granted, browser subscription present, AND the server holds that
 * endpoint for this user (it may belong to someone who used the browser
 * before, or have been pruned as dead).
 */
export async function isPushEnabledHere(): Promise<boolean> {
  if (getPermissionState() !== "granted") return false;
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return false;
  const res = await hasPushSubscription(subscription.endpoint);
  return res.success && res.data.subscribed;
}

function failure(reason: SubscribeFailure, message: string): SubscribeResult {
  return { ok: false, reason, message };
}

/**
 * Permission prompt -> pushManager.subscribe (with the server's public key)
 * -> persist via server action. Must be called from a user gesture (a click),
 * or browsers refuse to show the permission prompt.
 */
export async function subscribeToPush(): Promise<SubscribeResult> {
  const support = getPushSupport();
  if (support === "unsupported") {
    return failure("unsupported", "This browser can't receive push notifications.");
  }
  if (support === "insecure") {
    return failure("insecure", "Push notifications need a secure (https) connection.");
  }

  const keyRes = await getPushPublicKey();
  if (!keyRes.success) return failure("failed", keyRes.error);
  if (!keyRes.data.configured || !keyRes.data.publicKey) {
    return failure(
      "not-configured",
      "Push notifications aren't set up on the server yet. Ask an admin to add the VAPID keys."
    );
  }
  const applicationServerKey = urlBase64ToUint8Array(keyRes.data.publicKey);

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    permission = Notification.permission;
  }
  if (permission !== "granted") {
    return failure(
      "denied",
      "Notifications are blocked for this site. Allow them in your browser's site settings, then try again."
    );
  }

  try {
    const registration = await getRegistration();
    let subscription = await registration.pushManager.getSubscription();

    // A subscription made under a previous (rotated) VAPID key will be rejected
    // by the push service with 401/403 forever — drop it and subscribe afresh.
    if (
      subscription &&
      !sameKey(subscription.options.applicationServerKey, applicationServerKey)
    ) {
      await subscription.unsubscribe().catch(() => false);
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const json = subscription.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!json.endpoint || !p256dh || !auth) {
      throw new Error("Browser returned an incomplete push subscription");
    }

    const saved = await savePushSubscription({
      endpoint: json.endpoint,
      keys: { p256dh, auth },
      userAgent: navigator.userAgent.slice(0, 512),
    });
    if (!saved.success) return failure("failed", saved.error);
    return { ok: true };
  } catch (err) {
    console.error("[PUSH] subscribe failed", err);
    return failure(
      "failed",
      "Couldn't enable notifications on this device. Please try again."
    );
  }
}

/**
 * Unsubscribe at the browser and forget the endpoint server-side. Idempotent:
 * succeeds when there was nothing to remove.
 */
export async function unsubscribeFromPush(): Promise<{ ok: boolean; message?: string }> {
  try {
    const subscription = await getCurrentPushSubscription();
    if (!subscription) return { ok: true };
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => false);
    const res = await removePushSubscription(endpoint);
    return res.success ? { ok: true } : { ok: false, message: res.error };
  } catch (err) {
    console.error("[PUSH] unsubscribe failed", err);
    return { ok: false, message: "Couldn't turn off notifications on this device." };
  }
}
