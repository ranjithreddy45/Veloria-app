// ============================================================
// Redaction for logs and error reports — client-safe, no imports.
// ------------------------------------------------------------
// Customer phone numbers and emails must not reach server logs or Sentry
// (DPDP; logs are kept). Use maskPhoneForLog() when logging a known phone and
// redactForLog() for any free text; scrubSentryEvent / scrubSentryBreadcrumb
// run the same masking over everything Sentry is about to send.
// ============================================================

const EMAIL_RE = /([A-Z0-9._%+-])[A-Z0-9._%+-]*@([A-Z0-9.-]+\.[A-Z]{2,})/gi;
// A run of digits, spaces, dashes, dots or parentheses, optionally led by "+".
// Masked only when it holds 10–13 digits, so dates, amounts and ids survive.
const PHONE_RUN_RE = /\+?\d[\d\s().-]{8,}\d/g;

/** "+91 98xxxxxx21"-style mask: keeps only the last two digits. */
export function maskPhoneForLog(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-2)}`;
}

/** Mask every email and phone-like number in a piece of text. */
export function redactForLog(text: string): string {
  if (!text) return text;
  return text
    .replace(EMAIL_RE, (_m, first: string, domain: string) => `${first}***@${domain}`)
    .replace(PHONE_RUN_RE, (run) => {
      const digits = run.replace(/\D/g, "").length;
      return digits >= 10 && digits <= 13 ? maskPhoneForLog(run) : run;
    });
}

/** Deep-redact strings in a JSON-ish value (depth-limited, cycle-safe). */
export function redactDeep<T>(value: T, depth = 0, seen: WeakSet<object> = new WeakSet()): T {
  if (typeof value === "string") return redactForLog(value) as unknown as T;
  if (!value || typeof value !== "object" || depth > 8) return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1, seen)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redactDeep(v, depth + 1, seen);
  return out as T;
}

/** Sentry beforeSend: mask phones and emails anywhere in the event. */
export function scrubSentryEvent<E>(event: E): E {
  return redactDeep(event);
}

/** Sentry beforeBreadcrumb: same masking for breadcrumbs (fetch URLs, console). */
export function scrubSentryBreadcrumb<B>(breadcrumb: B): B {
  return redactDeep(breadcrumb);
}
