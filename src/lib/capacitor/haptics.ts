import { isCapacitor } from "./platform";

/**
 * Trigger an impact haptic feedback.
 * Style can be "light", "medium", or "heavy" (default: "medium").
 * Silent no-op on web.
 */
export async function hapticImpact(
  style?: "light" | "medium" | "heavy"
): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");

    const styleMap: Record<string, typeof ImpactStyle[keyof typeof ImpactStyle]> = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };

    await Haptics.impact({
      style: styleMap[style ?? "medium"],
    });
  } catch {
    // Silently ignore haptic errors
  }
}

/**
 * Trigger a notification haptic feedback.
 * Type can be "success", "warning", or "error" (default: "success").
 * Silent no-op on web.
 */
export async function hapticNotification(
  type?: "success" | "warning" | "error"
): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");

    const typeMap: Record<string, typeof NotificationType[keyof typeof NotificationType]> = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };

    await Haptics.notification({
      type: typeMap[type ?? "success"],
    });
  } catch {
    // Silently ignore haptic errors
  }
}

/**
 * Trigger a custom vibration for the given duration in milliseconds.
 * Default duration: 300ms. Silent no-op on web.
 */
export async function hapticVibrate(duration?: number): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    const { Haptics } = await import("@capacitor/haptics");

    await Haptics.vibrate({
      duration: duration ?? 300,
    });
  } catch {
    // Silently ignore haptic errors
  }
}

/**
 * Start a haptic selection gesture feedback.
 * Used at the beginning of a selection interaction (e.g., dragging a picker).
 * Silent no-op on web.
 */
export async function hapticSelectionStart(): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.selectionStart();
  } catch {
    // Silently ignore haptic errors
  }
}

/**
 * Provide haptic feedback during a selection change.
 * Called repeatedly as the user moves through options.
 * Silent no-op on web.
 */
export async function hapticSelectionChanged(): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.selectionChanged();
  } catch {
    // Silently ignore haptic errors
  }
}

/**
 * End a haptic selection gesture feedback.
 * Called when the user finishes the selection interaction.
 * Silent no-op on web.
 */
export async function hapticSelectionEnd(): Promise<void> {
  if (!isCapacitor()) {
    return;
  }

  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.selectionEnd();
  } catch {
    // Silently ignore haptic errors
  }
}
