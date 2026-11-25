// ============================================================
// Reading one email switch from User.notificationPreferences.
//
// The column holds [{ key, emailEnabled, smsEnabled }] rows saved from
// Settings → Notifications (src/actions/notification-settings.actions.ts).
// A missing or malformed value means the person never changed it: on.
// ============================================================

export function emailPrefEnabled(prefs: unknown, key: string): boolean {
  if (!Array.isArray(prefs)) return true;
  const row = prefs.find(
    (p): p is { key: string; emailEnabled?: unknown } =>
      !!p && typeof p === "object" && (p as { key?: unknown }).key === key
  );
  return row ? row.emailEnabled !== false : true;
}

/** Settings → Notifications key for the "employee punched in" email. */
export const ATTENDANCE_PUNCH_PREF = "attendance_punch";
