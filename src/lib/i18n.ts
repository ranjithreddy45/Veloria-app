// ============================================================
// Lightweight Custom i18n System
// ============================================================

/**
 * Supported locale codes.
 */
export type Locale = "en" | "hi" | "kn" | "te";

/**
 * All supported locales in the application.
 */
export const LOCALES: Locale[] = ["en", "hi", "kn", "te"];

/**
 * The default locale used when no preference is set.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Human-readable labels for each locale, displayed in their native script.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "\u0939\u093F\u0928\u094D\u0926\u0940",
  kn: "\u0C95\u0CA8\u0CCD\u0CA8\u0CA1",
  te: "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41",
};

/**
 * Type for the nested messages object loaded from JSON files.
 */
export type Messages = Record<string, Record<string, string> | string>;

/**
 * Loads translation messages for the given locale.
 * Falls back to English if the requested locale file cannot be loaded.
 *
 * This function uses dynamic imports and is intended for server-side usage
 * (e.g., in Server Components or `generateMetadata`).
 */
export async function getMessages(locale: Locale): Promise<Messages> {
  try {
    return (await import(`../../messages/${locale}.json`)).default;
  } catch {
    return (await import(`../../messages/en.json`)).default;
  }
}

/**
 * Retrieves a translation string from a nested messages object
 * using a dot-separated key path.
 *
 * @example
 *   getTranslation(messages, "common.save")    // "Save"
 *   getTranslation(messages, "nav.dashboard")   // "Dashboard"
 *   getTranslation(messages, "missing.key")     // "missing.key" (fallback)
 *
 * @param messages - The loaded messages object
 * @param key - Dot-separated path to the translation string
 * @returns The translated string, or the key itself if not found
 */
export function getTranslation(
  messages: Record<string, unknown>,
  key: string
): string {
  const keys = key.split(".");
  let result: unknown = messages;

  for (const k of keys) {
    if (result === null || result === undefined || typeof result !== "object") {
      return key;
    }
    result = (result as Record<string, unknown>)[k];
  }

  return typeof result === "string" ? result : key;
}
