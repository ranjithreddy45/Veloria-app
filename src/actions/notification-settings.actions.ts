"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { revalidatePath } from "next/cache";

// ============================================================
// Types
// ============================================================

export interface NotificationPreference {
  key: string;
  label: string;
  description: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

export interface NotificationPreferencesData {
  preferences: NotificationPreference[];
}

// Stored shape on User.notificationPreferences — only the toggleable fields.
// Static metadata (label, description) is merged in at read time so we can
// edit copy without migrations.
interface StoredPreference {
  key: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

// ============================================================
// Default Preferences (single source of truth)
// ============================================================

const DEFAULT_PREFERENCES: NotificationPreference[] = [
  {
    key: "booking_confirmed",
    label: "Booking Confirmed",
    description: "When a booking is confirmed or status changes.",
    emailEnabled: true,
    smsEnabled: false,
  },
  {
    key: "payment_received",
    label: "Payment Received",
    description: "When a payment is received for an invoice.",
    emailEnabled: true,
    smsEnabled: false,
  },
  {
    key: "payment_due",
    label: "Payment Due",
    description: "Reminder when a payment due date is approaching.",
    emailEnabled: true,
    smsEnabled: true,
  },
  {
    key: "event_reminder",
    label: "Event Reminder",
    description: "Reminder sent before an upcoming event.",
    emailEnabled: true,
    smsEnabled: true,
  },
  {
    key: "tasting_scheduled",
    label: "Tasting Scheduled",
    description: "When a tasting session is scheduled or updated.",
    emailEnabled: true,
    smsEnabled: false,
  },
  {
    key: "invoice_sent",
    label: "Invoice Sent",
    description: "When an invoice is sent to a client.",
    emailEnabled: true,
    smsEnabled: false,
  },
  {
    key: "task_assigned",
    label: "Task Assigned",
    description: "When a task is assigned to a team member.",
    emailEnabled: true,
    smsEnabled: false,
  },
  {
    key: "lead_assigned",
    label: "Lead Assigned",
    description: "When a new lead is assigned for follow-up.",
    emailEnabled: true,
    smsEnabled: false,
  },
];

// ============================================================
// Helpers
// ============================================================

/**
 * Merge user overrides on top of defaults — returns a full set even if the
 * user has only customized a few rows, and silently drops rows whose `key`
 * no longer exists in the catalog.
 */
function mergeWithDefaults(stored: StoredPreference[] | null): NotificationPreference[] {
  if (!stored || !Array.isArray(stored)) return DEFAULT_PREFERENCES;
  const map = new Map(stored.map((p) => [p.key, p]));
  return DEFAULT_PREFERENCES.map((def) => {
    const override = map.get(def.key);
    if (!override) return def;
    return {
      ...def,
      emailEnabled: Boolean(override.emailEnabled),
      smsEnabled: Boolean(override.smsEnabled),
    };
  });
}

// ============================================================
// getNotificationPreferences — reads from User.notificationPreferences
// ============================================================

export async function getNotificationPreferences(): Promise<{
  success: boolean;
  data?: NotificationPreferencesData;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "settings:read")) {
      return { success: false, error: "Insufficient permissions" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id as string },
      select: { notificationPreferences: true },
    });

    const stored = (user?.notificationPreferences as StoredPreference[] | null) ?? null;
    return {
      success: true,
      data: { preferences: mergeWithDefaults(stored) },
    };
  } catch (error) {
    console.error("[GET_NOTIFICATION_PREFS_ERROR]", error);
    return { success: false, error: "Failed to load notification preferences" };
  }
}

// ============================================================
// updateNotificationPreferences — persists to User.notificationPreferences
// ============================================================

export async function updateNotificationPreferences(
  preferences: NotificationPreference[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "settings:update")) {
      return { success: false, error: "Insufficient permissions" };
    }

    // Validate keys against the catalog so we don't store garbage
    const validKeys = new Set(DEFAULT_PREFERENCES.map((p) => p.key));
    const cleaned: StoredPreference[] = preferences
      .filter((p) => validKeys.has(p.key))
      .map((p) => ({
        key: p.key,
        emailEnabled: Boolean(p.emailEnabled),
        smsEnabled: Boolean(p.smsEnabled),
      }));

    await prisma.user.update({
      where: { id: session.user.id as string },
      data: { notificationPreferences: cleaned },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "NotificationPreferences",
      entityId: session.user.id as string,
    });

    revalidatePath("/settings/notifications");
    return { success: true, message: "Preferences saved" };
  } catch (error) {
    console.error("[UPDATE_NOTIFICATION_PREFS_ERROR]", error);
    return {
      success: false,
      error: "Failed to update notification preferences",
    };
  }
}

/**
 * Check whether a user has a notification channel enabled for a given event
 * type. Used by `notify()` and other senders to respect user preferences.
 * Defaults to ON if the user has no record.
 */
export async function shouldSendNotification(
  userId: string,
  eventKey: string,
  channel: "email" | "sms"
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });
    const merged = mergeWithDefaults(
      (user?.notificationPreferences as StoredPreference[] | null) ?? null
    );
    const pref = merged.find((p) => p.key === eventKey);
    if (!pref) return true; // unknown event type = send by default
    return channel === "email" ? pref.emailEnabled : pref.smsEnabled;
  } catch (error) {
    // Fail open — never block a notification due to a settings read error
    console.error("[SHOULD_SEND_NOTIFICATION_ERROR]", error);
    return true;
  }
}
