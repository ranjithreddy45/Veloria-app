import type {
  LocalNotificationSchema,
  ActionPerformed as LocalActionPerformed,
} from "@capacitor/local-notifications";
import { isCapacitor } from "./platform";

export interface ScheduleNotificationOptions {
  id: number;
  title: string;
  body: string;
  scheduledAt: Date;
  extra?: Record<string, unknown>;
}

export interface NotificationListenerCallbacks {
  onReceived?: (notification: LocalNotificationSchema) => void;
  onActionPerformed?: (action: LocalActionPerformed) => void;
}

let notificationListenerHandles: Array<{ remove: () => Promise<void> }> = [];

/**
 * Request permission for local notifications.
 * On web, uses the Notification API if available.
 * Returns true if permission is granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isCapacitor()) {
    try {
      const { LocalNotifications } = await import(
        "@capacitor/local-notifications"
      );

      let permStatus = await LocalNotifications.checkPermissions();

      if (permStatus.display === "prompt") {
        permStatus = await LocalNotifications.requestPermissions();
      }

      return permStatus.display === "granted";
    } catch (error) {
      console.error(
        "[notifications] Failed to request native permission:",
        error
      );
      return false;
    }
  }

  // Web fallback: use the Notification API
  if (
    typeof window !== "undefined" &&
    typeof Notification !== "undefined"
  ) {
    try {
      if (Notification.permission === "granted") {
        return true;
      }

      if (Notification.permission === "denied") {
        return false;
      }

      const result = await Notification.requestPermission();
      return result === "granted";
    } catch (error) {
      console.error(
        "[notifications] Failed to request web notification permission:",
        error
      );
      return false;
    }
  }

  console.info("[notifications] Notifications are not available.");
  return false;
}

/**
 * Schedule a local notification to fire at a specific time.
 * On web, uses the Notification API immediately if the scheduled time has passed,
 * or sets a timeout for future notifications.
 * Returns true if scheduled successfully.
 */
export async function scheduleLocalNotification(
  options: ScheduleNotificationOptions
): Promise<boolean> {
  if (isCapacitor()) {
    try {
      const { LocalNotifications } = await import(
        "@capacitor/local-notifications"
      );

      await LocalNotifications.schedule({
        notifications: [
          {
            id: options.id,
            title: options.title,
            body: options.body,
            schedule: { at: options.scheduledAt },
            extra: options.extra,
          },
        ],
      });

      return true;
    } catch (error) {
      console.error(
        "[notifications] Failed to schedule native notification:",
        error
      );
      return false;
    }
  }

  // Web fallback using the Notification API
  if (
    typeof window !== "undefined" &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    try {
      const delay = options.scheduledAt.getTime() - Date.now();

      if (delay <= 0) {
        // Fire immediately
        new Notification(options.title, { body: options.body });
      } else {
        // Schedule with setTimeout
        setTimeout(() => {
          new Notification(options.title, { body: options.body });
        }, delay);
      }

      return true;
    } catch (error) {
      console.error(
        "[notifications] Failed to schedule web notification:",
        error
      );
      return false;
    }
  }

  console.info(
    "[notifications] Cannot schedule notification: not available."
  );
  return false;
}

/**
 * Cancel a pending local notification by its id.
 * No-op on web.
 */
export async function cancelLocalNotification(id: number): Promise<boolean> {
  if (!isCapacitor()) {
    console.info(
      "[notifications] Cancel notification is not supported on web."
    );
    return false;
  }

  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );

    await LocalNotifications.cancel({
      notifications: [{ id }],
    });

    return true;
  } catch (error) {
    console.error(
      "[notifications] Failed to cancel notification:",
      error
    );
    return false;
  }
}

/**
 * Cancel all pending local notifications.
 * No-op on web.
 */
export async function cancelAllLocalNotifications(): Promise<boolean> {
  if (!isCapacitor()) {
    console.info(
      "[notifications] Cancel all notifications is not supported on web."
    );
    return false;
  }

  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }

    return true;
  } catch (error) {
    console.error(
      "[notifications] Failed to cancel all notifications:",
      error
    );
    return false;
  }
}

/**
 * Add listeners for local notification events.
 * No-op on web.
 */
export async function addNotificationListeners(
  callbacks: NotificationListenerCallbacks
): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );

    if (callbacks.onReceived) {
      const handle = await LocalNotifications.addListener(
        "localNotificationReceived",
        callbacks.onReceived
      );
      notificationListenerHandles.push(handle);
    }

    if (callbacks.onActionPerformed) {
      const handle = await LocalNotifications.addListener(
        "localNotificationActionPerformed",
        callbacks.onActionPerformed
      );
      notificationListenerHandles.push(handle);
    }
  } catch (error) {
    console.error(
      "[notifications] Failed to add notification listeners:",
      error
    );
  }
}

/**
 * Remove all previously added local notification listeners.
 * No-op on web.
 */
export async function removeNotificationListeners(): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    for (const handle of notificationListenerHandles) {
      await handle.remove();
    }
    notificationListenerHandles = [];
  } catch (error) {
    console.error(
      "[notifications] Failed to remove notification listeners:",
      error
    );
  }
}
