// ============================================================
// The WhatsApp templates this app actually sends, by name and language.
// ------------------------------------------------------------
// Test Connection compares them with the provider's approved list, because an
// unapproved (or differently-languaged) template fails at send time, per
// message, with nothing visible until someone opens the WhatsApp console.
// ============================================================

import { ReminderStage } from "@prisma/client";
import { WINBACK_FALLBACK_TEMPLATE } from "@/lib/winback/winback-config";

/** A template the app sends, and the language code it sends it in. */
export interface RequiredWhatsAppTemplate {
  name: string;
  language: string;
}

/** Every template send passes no language except the OTP, so the provider default applies. */
export const APP_TEMPLATE_LANGUAGE = "en";

/** Templates sent under a fixed name. */
export const FIXED_TEMPLATE_NAMES: readonly string[] = [
  "review_request", // reputation/review-request.ts
  "referral_invite", // reputation/referral-flywheel.ts
  "event_reminder", // site-visit confirmation + reminder
  // Guest journey: reminder-engine sends reminder.stage.toLowerCase().
  ...Object.values(ReminderStage).map((stage) => stage.toLowerCase()),
  // Win-back direct-fire fallbacks.
  ...Object.values(WINBACK_FALLBACK_TEMPLATE).filter((name): name is string => !!name),
];

/**
 * The templates to check: the configured OTP (in its own language), booking
 * update and guest invite templates, the enabled auto-welcome templates, and
 * the fixed names above. Deduplicated; blank names are ignored.
 */
export function requiredWhatsAppTemplates(
  settings: {
    otpTemplateName?: string | null;
    otpTemplateLanguage?: string | null;
    bookingUpdateTemplateName?: string | null;
    guestInviteTemplateName?: string | null;
  },
  autoWelcomeTemplateNames: ReadonlyArray<string | null | undefined> = []
): RequiredWhatsAppTemplate[] {
  const required: RequiredWhatsAppTemplate[] = [];
  const add = (name: string | null | undefined, language = APP_TEMPLATE_LANGUAGE) => {
    const trimmed = name?.trim();
    if (trimmed && !required.some((r) => r.name === trimmed && r.language === language)) {
      required.push({ name: trimmed, language });
    }
  };
  add(settings.otpTemplateName, settings.otpTemplateLanguage?.trim() || APP_TEMPLATE_LANGUAGE);
  add(settings.bookingUpdateTemplateName);
  add(settings.guestInviteTemplateName);
  for (const name of autoWelcomeTemplateNames) add(name);
  for (const name of FIXED_TEMPLATE_NAMES) add(name);
  return required;
}
