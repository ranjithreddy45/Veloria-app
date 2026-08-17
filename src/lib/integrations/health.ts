import { prisma } from "@/lib/prisma";

// ============================================================
// Is each integration actually configured?
//
// WHY THIS EXISTS. An audit of every `process.env.*` the code reads against
// what is actually set in production found 42 variables absent — including the
// credential for every outbound integration in the app: email, SMS, AI,
// Facebook lead ads, e-sign, and the WhatsApp webhook secrets.
//
// None of that announced itself. Every integration is written to degrade
// gracefully — `?? ""`, `|| ""`, `return null`, a swallowing catch — so a
// missing key produces silence rather than an error. sendEmail() has been
// returning { success: false, error: "Email not configured" } into a void for
// the life of the deployment.
//
// That is why the symptom reads as "the APIs keep failing" rather than
// "nothing is configured". Graceful degradation without a status surface is
// indistinguishable from a broken system, and it is UNDEBUGGABLE from inside
// the app: nothing on any screen says which integrations are live.
//
// So: one registry, checked at runtime, rendered where an admin can see it.
// Adding an integration without adding it here is the failure mode to watch —
// the registry is deliberately a plain list so that omission is visible in code
// review rather than discovered in production six months later.
// ============================================================

export type IntegrationState = "LIVE" | "NOT_CONFIGURED" | "PARTIAL";

export interface IntegrationStatus {
  key: string;
  label: string;
  category: "Messaging" | "Payments" | "Lead capture" | "AI" | "Documents" | "Platform";
  state: IntegrationState;
  /** Plain-language description of what is or is not set up. */
  detail: string;
  /** Exact variable names an operator has to add. */
  missing: string[];
  /** What silently does not happen while this is off. */
  impact: string;
}

const has = (v?: string | null) => Boolean(v && v.trim());

/** Names of the env vars in `names` that are absent. */
function absent(names: string[]): string[] {
  return names.filter((n) => !has(process.env[n]));
}

export async function getIntegrationHealth(): Promise<IntegrationStatus[]> {
  // WhatsApp is configured in the DATABASE, not the environment — checking env
  // alone would report it as dead when it is live, which would make this whole
  // screen untrustworthy.
  const waConfig = await prisma.whatsAppConfig
    .findFirst({
      where: { isActive: true },
      select: {
        provider: true,
        accessToken: true,
        phoneNumberId: true,
        businessAccountId: true,
        apiEndpoint: true,
        crmWebhookUrl: true,
      },
    })
    .catch(() => null);

  const out: IntegrationStatus[] = [];

  // ---- Messaging ---------------------------------------------------------
  const emailMissing = absent(["RESEND_API_KEY"]);
  out.push({
    key: "email",
    label: "Email (Resend)",
    category: "Messaging",
    state: emailMissing.length ? "NOT_CONFIGURED" : "LIVE",
    detail: emailMissing.length
      ? "No mail provider key. sendEmail() returns “Email not configured” for every call in the app."
      : "Mail provider key present.",
    missing: emailMissing,
    impact:
      "Lead-assignment emails, quotation sends, invoice emails, auto-replies and review requests all silently send nothing.",
  });

  const smsProvider = (process.env.SMS_PROVIDER || "").toUpperCase();
  const smsMissing = !smsProvider
    ? ["SMS_PROVIDER", "(then MSG91_AUTH_KEY or TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)"]
    : smsProvider === "MSG91"
      ? absent(["MSG91_AUTH_KEY", "MSG91_SENDER_ID"])
      : absent(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM"]);
  out.push({
    key: "sms",
    label: "SMS",
    category: "Messaging",
    state: smsMissing.length ? "NOT_CONFIGURED" : "LIVE",
    detail: smsProvider
      ? `Provider set to ${smsProvider}.`
      : "No SMS provider selected, so every SMS call is a no-op.",
    missing: smsMissing,
    impact: "Payment reminders, OTPs and event reminders sent by SMS do not go out.",
  });

  const waLive = has(waConfig?.accessToken);
  const waWebhookMissing = absent(["WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN"]);
  out.push({
    key: "whatsapp",
    label: `WhatsApp${waConfig?.provider ? ` (${waConfig.provider})` : ""}`,
    category: "Messaging",
    state: !waLive ? "NOT_CONFIGURED" : waWebhookMissing.length ? "PARTIAL" : "LIVE",
    detail: !waLive
      ? "No active WhatsApp configuration with an access token."
      : waWebhookMissing.length
        ? "Sending is configured. INBOUND webhook secrets are not, so replies cannot be signature-verified."
        : "Sending and inbound webhook both configured.",
    missing: waWebhookMissing,
    impact:
      "Without sending: no WhatsApp goes out. Without the webhook secrets: customer replies may be rejected or unverified.",
  });

  const templatesReady = has(waConfig?.businessAccountId);
  out.push({
    key: "whatsapp-templates",
    label: "WhatsApp approved templates (Meta)",
    category: "Messaging",
    state: templatesReady ? "LIVE" : "NOT_CONFIGURED",
    detail: templatesReady
      ? "Business Account ID present — templates can be synced from Meta."
      : "No Meta Business Account ID saved, so the approved-template list cannot be fetched. A Weflux API key alone cannot list templates; they live on Meta.",
    missing: templatesReady ? [] : ["WhatsAppConfig.businessAccountId (saved in WhatsApp settings, not env)"],
    impact: "Template names stay free text, so a wrong or paused template fails at send time with no warning.",
  });

  // ---- Payments ----------------------------------------------------------
  const rzpMissing = absent(["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]);
  const rzpHookMissing = absent(["RAZORPAY_WEBHOOK_SECRET"]);
  out.push({
    key: "razorpay",
    label: "Razorpay",
    category: "Payments",
    state: rzpMissing.length ? "NOT_CONFIGURED" : rzpHookMissing.length ? "PARTIAL" : "LIVE",
    detail: rzpMissing.length
      ? "API keys absent — no payment can be created."
      : rzpHookMissing.length
        ? "Keys present, webhook secret absent: payments can be taken but confirmations cannot be verified."
        : "Keys and webhook secret both present.",
    missing: [...rzpMissing, ...rzpHookMissing],
    impact:
      "Without the webhook secret a paid booking may never be marked paid, because the confirmation cannot be trusted.",
  });

  // ---- Lead capture ------------------------------------------------------
  const fbMissing = absent([
    "FACEBOOK_PAGE_ACCESS_TOKEN",
    "FACEBOOK_APP_SECRET",
    "FACEBOOK_WEBHOOK_VERIFY_TOKEN",
  ]);
  out.push({
    key: "facebook-leads",
    label: "Facebook / Instagram Lead Ads",
    category: "Lead capture",
    state: fbMissing.length === 3 ? "NOT_CONFIGURED" : fbMissing.length ? "PARTIAL" : "LIVE",
    detail: fbMissing.length
      ? "Lead-ad webhook credentials absent. Meta cannot verify the endpoint, so leads from Facebook forms never arrive."
      : "Lead-ad webhook configured.",
    missing: fbMissing,
    impact: "Paid social leads are lost silently — they never reach the CRM at all.",
  });

  const wefluxPush = has(waConfig?.crmWebhookUrl) || has(process.env.WEFLUX_CRM_WEBHOOK_URL);
  out.push({
    key: "weflux-crm",
    label: "Weflux CRM push",
    category: "Lead capture",
    state: wefluxPush ? "LIVE" : "NOT_CONFIGURED",
    detail: wefluxPush
      ? "New leads are pushed to Weflux."
      : "No Weflux CRM webhook URL, so new leads are not pushed and Weflux automations never fire.",
    missing: wefluxPush ? [] : ["WhatsAppConfig.crmWebhookUrl (or WEFLUX_CRM_WEBHOOK_URL)"],
    impact: "Weflux-side automations on a new lead do not run.",
  });

  // ---- AI ----------------------------------------------------------------
  const aiKeys = ["GOOGLE_AI_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY"];
  const anyAi = aiKeys.some((k) => has(process.env[k]));
  out.push({
    key: "ai",
    label: "AI (lead scoring, intent, reply drafts)",
    category: "AI",
    state: anyAi ? "LIVE" : "NOT_CONFIGURED",
    detail: anyAi ? "An AI provider key is present." : "No AI provider key of any kind.",
    missing: anyAi ? [] : aiKeys,
    impact: "AI lead scores, intent classification and suggested replies never populate.",
  });

  // ---- Documents ---------------------------------------------------------
  const esignMissing = absent(["ESIGN_PROVIDER", "ESIGN_API_KEY", "ESIGN_BASE_URL"]);
  out.push({
    key: "esign",
    label: "E-signature",
    category: "Documents",
    state: esignMissing.length === 3 ? "NOT_CONFIGURED" : esignMissing.length ? "PARTIAL" : "LIVE",
    detail: esignMissing.length
      ? "No e-sign provider configured; contracts cannot be sent for signature."
      : "E-sign provider configured.",
    missing: esignMissing,
    impact: "Contract e-signature requests cannot be sent.",
  });

  // ---- Platform ----------------------------------------------------------
  const cronMissing = absent(["CRON_SECRET"]);
  out.push({
    key: "cron",
    label: "Scheduled jobs",
    category: "Platform",
    state: cronMissing.length ? "NOT_CONFIGURED" : "LIVE",
    detail: cronMissing.length
      ? "No CRON_SECRET — every scheduled job endpoint rejects its caller."
      : "Cron authentication configured. Lane health is reported by /api/health.",
    missing: cronMissing,
    impact: "Reminders, expiry sweeps, reconciliations and backfills never run.",
  });

  return out;
}

/** Counts for a headline line. */
export function summarise(rows: IntegrationStatus[]) {
  return {
    live: rows.filter((r) => r.state === "LIVE").length,
    partial: rows.filter((r) => r.state === "PARTIAL").length,
    off: rows.filter((r) => r.state === "NOT_CONFIGURED").length,
    total: rows.length,
  };
}
