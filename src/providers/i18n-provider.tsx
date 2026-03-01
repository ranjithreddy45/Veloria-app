"use client";

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { getTranslation, type Locale } from "@/lib/i18n";

// ============================================================
// Context Types
// ============================================================

interface I18nContextValue {
  /** The current active locale. */
  locale: Locale;
  /** The full messages object for the current locale. */
  messages: Record<string, unknown>;
  /**
   * Translation function. Accepts a dot-separated key and returns
   * the corresponding translated string.
   *
   * @example t("common.save") // "Save"
   */
  t: (key: string) => string;
}

// ============================================================
// Context
// ============================================================

const I18nContext = createContext<I18nContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface I18nProviderProps {
  locale: Locale;
  messages: Record<string, unknown>;
  children: ReactNode;
}

/**
 * Provides i18n context to the component tree.
 *
 * Wrap your layout or page with this provider, passing the
 * current locale and pre-loaded messages from the server.
 *
 * @example
 *   // In a Server Component (layout.tsx):
 *   const locale = await getLocale();
 *   const messages = await getMessages(locale);
 *
 *   <I18nProvider locale={locale} messages={messages}>
 *     {children}
 *   </I18nProvider>
 */
export function I18nProvider({ locale, messages, children }: I18nProviderProps) {
  const t = useCallback(
    (key: string) => getTranslation(messages, key),
    [messages]
  );

  return (
    <I18nContext.Provider value={{ locale, messages, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

/**
 * Hook to access translations and the current locale.
 *
 * Must be used within an `<I18nProvider>`.
 *
 * @example
 *   const { t, locale } = useTranslations();
 *   return <button>{t("common.save")}</button>;
 */
export function useTranslations(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error(
      "useTranslations must be used within an <I18nProvider>. " +
        "Make sure your component tree is wrapped with I18nProvider."
    );
  }
  return context;
}
