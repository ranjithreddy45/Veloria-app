import type {
  Token,
  PushNotificationSchema,
  ActionPerformed,
  RegistrationError,
} from "@capacitor/push-notifications";
import { isCapacitor } from "./platform";

export interface PushListenerCallbacks {
  onRegistration?: (token: Token) => void;
  onRegistrationError?: (error: RegistrationError) => void;
  onPushNotificationReceived?: (notification: PushNotificationSchema) => void;
  onPushNotificationActionPerformed?: (action: ActionPerformed) => void;
}

let listenerHandles: Array<{ remove: () => Promise<void> }> = [];

/**
 * Register for push notifications on native platforms.
 * Checks and requests permission, then registers with APNs/FCM.
 * Returns the device token string, or null on web / if denied.
 */
export async function registerPushNotifications(): Promise<string | null> {
  if (!isCapacitor()) {
    console.info("[push] Push notifications are not available on web.");
    return null;
  }

  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );

    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== "granted") {
      console.info("[push] Push notification permission not granted.");
      return null;
    }

    await PushNotifications.register();

    // Wait for the registration event to get the token
    return new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, 10_000);

      PushNotifications.addListener("registration", (token: Token) => {
        clearTimeout(timeout);
        resolve(token.value);
      });

      PushNotifications.addListener(
        "registrationError",
        (error: RegistrationError) => {
          clearTimeout(timeout);
          console.error("[push] Registration error:", error);
          resolve(null);
        }
      );
    });
  } catch (error) {
    console.error("[push] Failed to register push notifications:", error);
    return null;
  }
}

/**
 * Add listeners for push notification events on native platforms.
 * No-op on web.
 */
export async function addPushListeners(
  callbacks: PushListenerCallbacks
): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );

    if (callbacks.onRegistration) {
      const handle = await PushNotifications.addListener(
        "registration",
        callbacks.onRegistration
      );
      listenerHandles.push(handle);
    }

    if (callbacks.onRegistrationError) {
      const handle = await PushNotifications.addListener(
        "registrationError",
        callbacks.onRegistrationError
      );
      listenerHandles.push(handle);
    }

    if (callbacks.onPushNotificationReceived) {
      const handle = await PushNotifications.addListener(
        "pushNotificationReceived",
        callbacks.onPushNotificationReceived
      );
      listenerHandles.push(handle);
    }

    if (callbacks.onPushNotificationActionPerformed) {
      const handle = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        callbacks.onPushNotificationActionPerformed
      );
      listenerHandles.push(handle);
    }
  } catch (error) {
    console.error("[push] Failed to add push listeners:", error);
  }
}

/**
 * Remove all previously added push notification listeners.
 * No-op on web.
 */
export async function removePushListeners(): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    for (const handle of listenerHandles) {
      await handle.remove();
    }
    listenerHandles = [];
  } catch (error) {
    console.error("[push] Failed to remove push listeners:", error);
  }
}
