"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";

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

// ============================================================
// Default Preferences
// ============================================================
// Placeholder defaults — in production these would come from DB.

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
// getNotificationPreferences
// ============================================================

export async function getNotificationPreferences(): Promise<{
  success: boolean;
  data?: NotificationPreferencesData;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "sms:read")) {
      return { success: false, error: "Insufficient permissions" };
    }

    // TODO: Implement database persistence
    // Placeholder: return defaults (would load from DB in production)
    return {
      success: true,
      data: { preferences: DEFAULT_PREFERENCES },
    };
  } catch (error) {
    console.error("[GET_NOTIFICATION_PREFS_ERROR]", error);
    return { success: false, error: "Failed to load notification preferences" };
  }
}

// ============================================================
// updateNotificationPreferences
// ============================================================

export async function updateNotificationPreferences(
  preferences: NotificationPreference[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "sms:manage")) {
      return { success: false, error: "Insufficient permissions" };
    }

    // TODO: Implement database persistence
    // Placeholder: log to console (would persist to DB in production)
    console.log(
      "[NOTIFICATION_PREFS] Updated by:",
      session.user.email,
      JSON.stringify(preferences, null, 2)
    );

    return {
      success: true,
      message: "Preferences saved for this session (database persistence coming soon)",
    };
  } catch (error) {
    console.error("[UPDATE_NOTIFICATION_PREFS_ERROR]", error);
    return {
      success: false,
      error: "Failed to update notification preferences",
    };
  }
}
