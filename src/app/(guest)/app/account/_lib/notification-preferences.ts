import { z } from "zod";

// ============================================================
// Customer notification preferences: pure parsing and serialising for
// User.notificationPreferences, the JSON column the team's Settings >
// Notifications screen writes and shouldSendNotification() reads
// (src/actions/notification-settings.actions.ts). That file keeps its parser
// private (a "use server" module may only export async functions), so the
// stored shape and the catalog are mirrored here. A unit test fails if the
// two catalogs drift apart.
//
// Stored shape: Array<{ key: string; emailEnabled: boolean; smsEnabled: boolean }>
// null, or anything malformed, means "use the defaults".
// ============================================================

export interface StoredNotificationPreference {
  key: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

const storedPreferencesSchema = z.array(
  z.object({
    key: z.string(),
    emailEnabled: z.boolean(),
    smsEnabled: z.boolean(),
  })
);

/** Every key the app knows, with its default, in the team catalog's order (DEFAULT_PREFERENCES). */
export const NOTIFICATION_CATALOG: readonly StoredNotificationPreference[] = [
  { key: "booking_confirmed", emailEnabled: true, smsEnabled: false },
  { key: "payment_received", emailEnabled: true, smsEnabled: false },
  { key: "payment_due", emailEnabled: true, smsEnabled: true },
  { key: "event_reminder", emailEnabled: true, smsEnabled: true },
  { key: "tasting_scheduled", emailEnabled: true, smsEnabled: false },
  { key: "invoice_sent", emailEnabled: true, smsEnabled: false },
  { key: "task_assigned", emailEnabled: true, smsEnabled: false },
  { key: "lead_assigned", emailEnabled: true, smsEnabled: false },
];

/** The rows a customer may change. task_assigned and lead_assigned are team-only. */
export const CUSTOMER_NOTIFICATION_KEYS = [
  "booking_confirmed",
  "invoice_sent",
  "payment_due",
  "payment_received",
  "event_reminder",
  "tasting_scheduled",
] as const;

export type CustomerNotificationKey = (typeof CUSTOMER_NOTIFICATION_KEYS)[number];

export const CUSTOMER_NOTIFICATION_COPY: Record<CustomerNotificationKey, { label: string; description: string }> = {
  booking_confirmed: { label: "Booking updates", description: "When your booking is confirmed or its status changes." },
  invoice_sent: { label: "Invoices", description: "When the team sends you an invoice." },
  payment_due: { label: "Payment reminders", description: "Before a payment falls due." },
  payment_received: { label: "Payment receipts", description: "When we receive a payment from you." },
  event_reminder: { label: "Event reminders", description: "In the days before your event." },
  tasting_scheduled: { label: "Tastings", description: "When a tasting is booked or moved." },
};

/**
 * Does anything that sends email or SMS honour these choices yet?
 *
 * Not today: shouldSendNotification() has no callers, and the event reminder
 * texts go to the booking's phone without checking. Switches that change
 * nothing would be a dead control, so the account screen hides them while
 * this is false. Flip it in the same change that makes the senders check.
 */
export const NOTIFICATION_PREFERENCES_ENFORCED = false;

export interface CustomerNotificationRow extends StoredNotificationPreference {
  key: CustomerNotificationKey;
  label: string;
  description: string;
}

export interface NotificationPreferenceChange {
  key: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

export function isCustomerNotificationKey(key: string): key is CustomerNotificationKey {
  return (CUSTOMER_NOTIFICATION_KEYS as readonly string[]).includes(key);
}

/** Same rule as the team's parseStored(): the whole value parses, or it is ignored (null). */
export function parseNotificationPreferences(value: unknown): StoredNotificationPreference[] | null {
  const result = storedPreferencesSchema.safeParse(value);
  if (!result.success) return null;
  return result.data.map((p) => ({ key: p.key, emailEnabled: p.emailEnabled, smsEnabled: p.smsEnabled }));
}

/** Same rule as the team's mergeWithDefaults(): every catalog key, stored values on top, unknown keys dropped. */
export function resolveNotificationPreferences(value: unknown): StoredNotificationPreference[] {
  const overrides = new Map((parseNotificationPreferences(value) ?? []).map((p) => [p.key, p] as const));
  return NOTIFICATION_CATALOG.map((def) => {
    const o = overrides.get(def.key);
    return {
      key: def.key,
      emailEnabled: o ? o.emailEnabled : def.emailEnabled,
      smsEnabled: o ? o.smsEnabled : def.smsEnabled,
    };
  });
}

/** The customer's rows, with the words the account screen shows. */
export function customerNotificationRows(value: unknown): CustomerNotificationRow[] {
  const resolved = new Map(resolveNotificationPreferences(value).map((p) => [p.key, p] as const));
  return CUSTOMER_NOTIFICATION_KEYS.map((key) => {
    const p = resolved.get(key);
    return {
      key,
      emailEnabled: p?.emailEnabled ?? true,
      smsEnabled: p?.smsEnabled ?? false,
      ...CUSTOMER_NOTIFICATION_COPY[key],
    };
  });
}

/**
 * The value to store after a customer's change: the full catalog (the shape
 * the team's writer produces), current values kept for every row the customer
 * cannot edit, and edits applied only to customer rows. Anything else in
 * `changes` is ignored.
 */
export function serializeNotificationPreferences(
  current: unknown,
  changes: readonly NotificationPreferenceChange[]
): StoredNotificationPreference[] {
  const edits = new Map<string, NotificationPreferenceChange>();
  for (const c of changes) {
    if (
      c &&
      typeof c.key === "string" &&
      isCustomerNotificationKey(c.key) &&
      typeof c.emailEnabled === "boolean" &&
      typeof c.smsEnabled === "boolean"
    ) {
      edits.set(c.key, c);
    }
  }
  return resolveNotificationPreferences(current).map((p) => {
    const e = edits.get(p.key);
    return e ? { key: p.key, emailEnabled: e.emailEnabled, smsEnabled: e.smsEnabled } : p;
  });
}
