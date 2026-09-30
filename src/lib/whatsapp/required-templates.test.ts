import { describe, expect, it, vi } from "vitest";

// winback-config (imported for the win-back template names) also exports a
// Prisma-backed resolver; nothing here queries, so an empty stub is enough.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { FIXED_TEMPLATE_NAMES, requiredWhatsAppTemplates } from "./required-templates";

describe("requiredWhatsAppTemplates", () => {
  it("lists every template the app sends under a fixed name, in en", () => {
    expect([...FIXED_TEMPLATE_NAMES].sort()).toEqual(
      [
        "day_of_welcome",
        "event_reminder",
        "excitement_builder",
        "final_countdown",
        "referral_invite",
        "review_request",
        "save_the_date",
        "tomorrow_reminder",
        "winback_event_proximity",
        "winback_lost_lead",
        "winback_quote_followup",
      ].sort()
    );
    expect(requiredWhatsAppTemplates({}).every((r) => r.language === "en")).toBe(true);
  });

  it("adds the configured templates first, the OTP one in its own language, then the auto-welcomes", () => {
    const required = requiredWhatsAppTemplates(
      {
        otpTemplateName: "login_code",
        otpTemplateLanguage: "en_US",
        bookingUpdateTemplateName: " booking_update ",
        guestInviteTemplateName: null,
      },
      ["welcome_meta", "", null, "welcome_meta"]
    );
    expect(required.slice(0, 3)).toEqual([
      { name: "login_code", language: "en_US" },
      { name: "booking_update", language: "en" },
      { name: "welcome_meta", language: "en" },
    ]);
    expect(required).toHaveLength(3 + FIXED_TEMPLATE_NAMES.length);
  });

  it("sends the OTP template in en when no language is saved, and lists a name once per language", () => {
    const required = requiredWhatsAppTemplates({ otpTemplateName: "review_request", bookingUpdateTemplateName: "review_request" });
    expect(required.filter((r) => r.name === "review_request")).toEqual([{ name: "review_request", language: "en" }]);
  });
});
