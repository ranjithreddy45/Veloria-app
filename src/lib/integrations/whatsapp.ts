// ============================================================
// WhatsApp Business API — Meta Cloud API Integration
// ============================================================
// Sends messages via Meta WhatsApp Cloud API v21.0
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

import { prisma } from "@/lib/prisma";
import { wefluxSendText, wefluxSendTemplate, wefluxTestConnection } from "@/lib/integrations/weflux";
import { AiSensyClient, AiSensyError } from "@/lib/whatsapp/aisensy/client";
import { formatWhatsAppFailure } from "@/lib/whatsapp/failure-reason";
import type { RequiredWhatsAppTemplate } from "@/lib/whatsapp/required-templates";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ============================================================
// Types
// ============================================================

export interface WhatsAppApiConfig {
  /** "META" (Cloud API), "WEFLUX" or "AISENSY". Defaults to META for legacy rows. */
  provider: string;
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  appSecret?: string | null;
  verifyToken?: string;
  /** Weflux API base (optional — defaults to https://api.weflux.in/v2). */
  apiEndpoint?: string | null;
  aisensyProjectId?: string | null;
  aisensyApiPassword?: string | null;
  aisensyApiEndpoint?: string | null;

}

interface SendWhatsAppParams {
  to: string; // phone number (international format)
  template?: string; // template name
  message?: string; // custom text message
  params?: Record<string, string>; // template params
  language?: string; // template language code (default "en")
  codeButton?: string; // one-time code for an authentication template's copy-code button (Meta)
}

interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================
// Get active WhatsApp configuration from DB
// ============================================================

export async function getWhatsAppApiConfig(): Promise<WhatsAppApiConfig | null> {
  try {
    const config = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) return null;

    return {
      provider: config.provider || "META",
      accessToken: config.accessToken,
      phoneNumberId: config.phoneNumberId ?? "",
      businessAccountId: config.businessAccountId ?? "",
      appSecret: config.appSecret,
      verifyToken: config.verifyToken,
      apiEndpoint: config.apiEndpoint,
      aisensyProjectId: config.aisensyProjectId,
      aisensyApiPassword: config.aisensyApiPassword,
      aisensyApiEndpoint: config.aisensyApiEndpoint,
    };
  } catch (error) {
    console.error("[WhatsApp] Failed to load config:", error);
    return null;
  }
}

// ============================================================
// Normalize phone number for WhatsApp API
// ============================================================

function normalizePhone(phone: string): string {
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-()]+/g, "");

  // Remove leading +
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  // If it starts with 0, assume Indian number — replace with 91
  if (cleaned.startsWith("0")) {
    cleaned = "91" + cleaned.slice(1);
  }

  // Only a 10-digit number in India's mobile range (first digit 6-9) may be
  // assumed Indian. A US/UK number is also 10 digits but starts 2-5, and
  // prepending 91 to it sends the message to a different person's phone.
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    cleaned = "91" + cleaned;
  }

  return cleaned;
}


// ============================================================
// AiSensy adapter
// ------------------------------------------------------------
// Translates this app's one send shape onto the AiSensy client that shipped in
// the integration package. Errors come back as { success: false, error } —
// never thrown — because sendWhatsApp() is called from crons, webhooks and
// server actions that all treat a throw as a failure of the whole operation.
// ============================================================

/** Client errors raised before any HTTP exchange: their own message says it all. */
const AISENSY_LOCAL_ERROR_CODES = new Set(["CONFIG", "INVALID_PHONE", "EMPTY_TEXT", "EMPTY_TEMPLATE", "TIMEOUT", "NETWORK"]);

/**
 * One line for a failed AiSensy call — what the console stores as the failure
 * reason: the HTTP status, AiSensy's or Meta's error code, and their message
 * (plus Meta's error_data.details when present). Never the request path (it
 * carries the project id) and never a header; the caller still passes the
 * result through formatWhatsAppFailure with the password as a known secret.
 *   "AiSensy HTTP 400 [ERR400]: template not found"
 *   "AiSensy HTTP 400 [131047]: Re-engagement message — Message failed to send because …"
 */
function describeAiSensyError(error: unknown): string {
  if (!(error instanceof AiSensyError)) {
    return error instanceof Error ? error.message : String(error ?? "");
  }
  if (error.status === 0 || AISENSY_LOCAL_ERROR_CODES.has(error.code ?? "")) {
    return /^AiSensy\b/.test(error.message) ? error.message : `AiSensy: ${error.message}`;
  }
  // The client words it "AiSensy <METHOD> <path> failed (<status>): <text>"; keep <text>.
  let text = error.message.replace(/^AiSensy \S+ \S+ failed \(\d+\):\s*/, "");
  // A gateway's HTML error page: keep the words, drop the markup.
  if (/^\s*</.test(text)) text = text.replace(/<[^>]*>/g, " ");
  const body = (error.body && typeof error.body === "object" ? error.body : {}) as {
    error?: { error_data?: { details?: unknown } };
  };
  const details = body.error?.error_data?.details;
  if (typeof details === "string" && details.trim() && !text.includes(details.trim())) {
    text = text.trim() ? `${text.trim()} — ${details.trim()}` : details.trim();
  }
  const code = error.code ? ` [${error.code}]` : "";
  return `AiSensy HTTP ${error.status}${code}${text.trim() ? `: ${text.trim()}` : ""}`;
}

async function aisensySend(
  config: WhatsAppApiConfig,
  to: string,
  params: SendWhatsAppParams
): Promise<SendWhatsAppResult> {
  const projectId = config.aisensyProjectId?.trim();
  const apiPassword = config.aisensyApiPassword?.trim();
  if (!projectId || !apiPassword) {
    return {
      success: false,
      error: "AiSensy is selected but its Project ID or API password is missing. Set them in Settings → Integrations → WhatsApp.",
    };
  }

  try {
    // Inside the try: the constructor rejects a bad base URL by throwing, and a
    // throw from here would break the "never throws" contract above.
    const client = new AiSensyClient({
      projectId,
      apiPassword,
      ...(config.aisensyApiEndpoint ? { baseUrl: config.aisensyApiEndpoint } : {}),
    });
    if (params.template) {
      // AiSensy wants the body values in order for {{1}}, {{2}}…; this app
      // passes a NAMED record ({ customerName, eventName, … }). Object.values
      // is exactly how the Meta branch below already turns that record into
      // ordered parameters, so a template behaves identically on either
      // provider. It relies on the object's insertion order — the same
      // assumption the Meta path has always made.
      const res = await client.sendTemplate(to, params.template, {
        ...(params.language ? { language: params.language } : {}),
        ...(params.params ? { bodyParams: Object.values(params.params) } : {}),
        // An AUTHENTICATION template's copy-code button needs the code too, as
        // the URL-button parameter at index 0 — the same component the Meta
        // branch adds in sendTemplateMessage(). Without it Meta rejects the send.
        ...(params.codeButton ? { urlButtonParams: { 0: params.codeButton } } : {}),
      });
      return { success: true, messageId: res.messageId };
    }
    if (!params.message) {
      return { success: false, error: "No message content provided" };
    }
    const res = await client.sendText(to, params.message);
    return { success: true, messageId: res.messageId };
  } catch (error) {
    // Stored as the message's failureReason: informative, one line, and never
    // carrying the password (or a one-time code) even if AiSensy echoes it back.
    const message = formatWhatsAppFailure(describeAiSensyError(error) || "AiSensy send failed", {
      secrets: [apiPassword, params.codeButton],
    });
    console.error("[AiSensy] send failed:", message);
    return { success: false, error: message };
  }
}

// ============================================================
// Send WhatsApp Text Message
// ============================================================

export async function sendWhatsApp(
  params: SendWhatsAppParams
): Promise<SendWhatsAppResult> {
  const config = await getWhatsAppApiConfig();

  if (!config) {
    return {
      success: false,
      error: "WhatsApp not configured. Set up your credentials in Settings → Integrations → WhatsApp.",
    };
  }

  const to = normalizePhone(params.to);

  // ---- Weflux provider branch --------------------------------------------
  // All ~25 callers keep working: same SendWhatsAppResult shape either way.
  if (config.provider === "WEFLUX") {
    const creds = { endpoint: config.apiEndpoint, token: config.accessToken };
    if (params.template) {
      return await wefluxSendTemplate(creds, to, params.template, params.params, params.language);
    }
    if (!params.message) {
      return { success: false, error: "No message content provided" };
    }
    return await wefluxSendText(creds, to, params.message);
  }

  // ---- AiSensy provider branch -------------------------------------------
  // Same SendWhatsAppResult shape as Meta and Weflux, so all ~25 callers are
  // unchanged. A missing credential is reported as a configuration error
  // rather than throwing, because every caller treats a throw as a crash.
  if (config.provider === "AISENSY") {
    return await aisensySend(config, to, params);
  }

  try {
    // If a template is specified, send template message
    if (params.template) {
      return await sendTemplateMessage(config, to, params.template, params.params, params.language, params.codeButton);
    }

    // Otherwise send a text message
    if (!params.message) {
      return { success: false, error: "No message content provided" };
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: {
            preview_url: true,
            body: params.message,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data?.error?.message || `API error ${response.status}`;
      console.error("[WhatsApp API Error]", JSON.stringify(data));
      return { success: false, error: errorMsg };
    }

    const messageId = data?.messages?.[0]?.id;

    console.log(
      `[WhatsApp] Message sent to ${to} — ID: ${messageId}`
    );

    return {
      success: true,
      messageId: messageId || undefined,
    };
  } catch (error) {
    console.error("[WhatsApp] Send failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// ============================================================
// Send Interactive Message (list / reply-buttons)
// ------------------------------------------------------------
// WhatsApp interactive messages — a tappable list or up to 3 reply buttons.
// Only valid inside the 24h customer-service window (the caller falls back to a
// plain text prompt when this fails). Returns the same shape as sendWhatsApp so
// callers handle success/messageId/error uniformly.
// ============================================================

export interface WhatsAppInteractiveRow {
  id: string;
  title: string;
  description?: string;
}

export interface SendWhatsAppInteractiveParams {
  to: string;
  header?: string;
  body: string;
  footer?: string;
  /** Reply-buttons variant (max 3). Mutually exclusive with `list`. */
  buttons?: { id: string; title: string }[];
  /** Single-select list variant. Mutually exclusive with `buttons`. */
  list?: {
    button: string;
    sections: { title?: string; rows: WhatsAppInteractiveRow[] }[];
  };
}

export async function sendWhatsAppInteractive(
  params: SendWhatsAppInteractiveParams
): Promise<SendWhatsAppResult> {
  const config = await getWhatsAppApiConfig();
  if (!config) {
    return {
      success: false,
      error: "WhatsApp not configured. Set up your credentials in Settings → Integrations → WhatsApp.",
    };
  }

  const to = normalizePhone(params.to);

  // Weflux has no drop-in equivalent of Meta's inline interactive payload, so we
  // degrade gracefully: send the header/body/footer as a plain text message
  // (the catalog engine already treats a text send as an acceptable fallback).
  if (config.provider === "WEFLUX") {
    const lines = [params.header, params.body, params.footer].filter(Boolean).join("\n\n");
    return await wefluxSendText(
      { endpoint: config.apiEndpoint, token: config.accessToken },
      to,
      lines || params.body
    );
  }

  // AiSensy: the adapter sends templates and text only, so degrade exactly like
  // Weflux above. Without this branch an AiSensy account fell through to the
  // Meta Graph call below with Meta credentials it does not have.
  if (config.provider === "AISENSY") {
    const lines = [params.header, params.body, params.footer].filter(Boolean).join("\n\n");
    return await aisensySend(config, to, { to, message: lines || params.body });
  }

  // Build the interactive object: a `list` (single-select) or reply `button`s.
  // Meta caps button title at 20 chars and reply buttons at 3 — clamp/slice so a
  // long option can never reject the whole send.
  let interactive: Record<string, unknown>;
  if (params.list) {
    interactive = {
      type: "list",
      ...(params.header ? { header: { type: "text", text: params.header.slice(0, 60) } } : {}),
      body: { text: params.body },
      ...(params.footer ? { footer: { text: params.footer.slice(0, 60) } } : {}),
      action: {
        button: params.list.button.slice(0, 20),
        sections: params.list.sections.map((s) => ({
          ...(s.title ? { title: s.title.slice(0, 24) } : {}),
          rows: s.rows.slice(0, 10).map((r) => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        })),
      },
    };
  } else {
    interactive = {
      type: "button",
      ...(params.header ? { header: { type: "text", text: params.header.slice(0, 60) } } : {}),
      body: { text: params.body },
      ...(params.footer ? { footer: { text: params.footer.slice(0, 60) } } : {}),
      action: {
        buttons: (params.buttons ?? []).slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
        })),
      },
    };
  }

  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "interactive",
          interactive,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      const errorMsg = data?.error?.message || `API error ${response.status}`;
      console.error("[WhatsApp Interactive Error]", JSON.stringify(data));
      return { success: false, error: errorMsg };
    }
    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId: messageId || undefined };
  } catch (error) {
    console.error("[WhatsApp] Interactive send failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// ============================================================
// Send Template Message
// ============================================================

async function sendTemplateMessage(
  config: WhatsAppApiConfig,
  to: string,
  templateName: string,
  params?: Record<string, string>,
  language?: string,
  codeButton?: string
): Promise<SendWhatsAppResult> {
  try {
    // Build template components from params
    const components: object[] = [];

    if (params && Object.keys(params).length > 0) {
      const parameters = Object.values(params).map((value) => ({
        type: "text",
        text: value,
      }));

      components.push({
        type: "body",
        parameters,
      });
    }

    // Authentication (one-time code) templates also carry the code on their button.
    if (codeButton) {
      components.push({
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: codeButton }],
      });
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: language || "en" },
            ...(components.length > 0 ? { components } : {}),
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data?.error?.message || `Template API error ${response.status}`;
      console.error("[WhatsApp Template Error]", JSON.stringify(data));
      return { success: false, error: errorMsg };
    }

    const messageId = data?.messages?.[0]?.id;

    console.log(
      `[WhatsApp] Template "${templateName}" sent to ${to} — ID: ${messageId}`
    );

    return {
      success: true,
      messageId: messageId || undefined,
    };
  } catch (error) {
    console.error("[WhatsApp] Template send failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// ============================================================
// Test WhatsApp Connection
// ============================================================

/** Approved template names Test Connection lists before summarising the rest. */
const APPROVED_TEMPLATES_LISTED = 60;

const languageKey = (language: unknown) => String(language ?? "").trim().toLowerCase().replace(/-/g, "_");

/**
 * The AiSensy Test Connection report, one finding per line:
 *   Connected to AiSensy project P. 3 of 4 templates approved: a, b, c.
 *   Missing or not approved: review_request, winback_lost_lead.
 *   Language mismatch: booking_update (en_US, app sends en).
 * `required` is what the app sends (requiredWhatsAppTemplates). Pure.
 */
export function describeAiSensyTemplates(
  projectId: string,
  templates: ReadonlyArray<{ name?: unknown; status?: unknown; language?: unknown }>,
  required: ReadonlyArray<RequiredWhatsAppTemplate> = []
): string {
  const approved = templates.filter((t) => String(t.status ?? "").toUpperCase() === "APPROVED");
  const nameOf = (t: { name?: unknown }) => String(t.name ?? "").trim();
  const names = [...new Set(approved.map(nameOf).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const listed = names.slice(0, APPROVED_TEMPLATES_LISTED).join(", ");
  const more = names.length > APPROVED_TEMPLATES_LISTED ? ` and ${names.length - APPROVED_TEMPLATES_LISTED} more` : "";
  const lines = [
    `Connected to AiSensy project ${projectId}. ${approved.length} of ${templates.length} ` +
      `templates approved${listed ? `: ${listed}${more}` : ""}.`,
  ];

  const missing: string[] = [];
  const wrongLanguage: string[] = [];
  for (const { name, language } of required) {
    const variants = approved.filter((t) => nameOf(t) === name);
    if (variants.length === 0) {
      if (!missing.includes(name)) missing.push(name);
      continue;
    }
    const languages = [...new Set(variants.map((t) => String(t.language ?? "").trim()))];
    // A variant AiSensy reports without a language can't be judged: don't flag it.
    if (languages.includes("") || languages.some((l) => languageKey(l) === languageKey(language))) continue;
    wrongLanguage.push(`${name} (${languages.join("/")}, app sends ${language})`);
  }
  if (missing.length) lines.push(`Missing or not approved: ${missing.join(", ")}.`);
  if (wrongLanguage.length) lines.push(`Language mismatch: ${wrongLanguage.join(", ")}.`);
  return lines.join("\n");
}

export async function testWhatsAppConnection(
  config: WhatsAppApiConfig,
  /** AiSensy only: the templates the app sends, checked against the approved list. */
  requiredTemplates: ReadonlyArray<RequiredWhatsAppTemplate> = []
): Promise<{ success: boolean; message: string; phoneNumber?: string }> {
  // Weflux: validate the API key (endpoint defaults to api.weflux.in/v2).
  if (config.provider === "WEFLUX") {
    return await wefluxTestConnection({ endpoint: config.apiEndpoint, token: config.accessToken });
  }

  // AiSensy: list the templates. That both proves the credentials and answers
  // the question that actually decides whether a switch is safe — which of the
  // templates this app sends are APPROVED (in the language it sends them in),
  // since an unapproved name fails at send time, per message, silently.
  if (config.provider === "AISENSY") {
    const projectId = config.aisensyProjectId?.trim();
    const apiPassword = config.aisensyApiPassword?.trim();
    if (!projectId || !apiPassword) {
      return { success: false, message: "Enter the AiSensy Project ID and API password first." };
    }
    try {
      const client = new AiSensyClient({
        projectId,
        apiPassword,
        ...(config.aisensyApiEndpoint ? { baseUrl: config.aisensyApiEndpoint } : {}),
      });
      const templates = await client.listTemplates();
      return { success: true, message: describeAiSensyTemplates(projectId, templates, requiredTemplates) };
    } catch (error) {
      return {
        success: false,
        message: formatWhatsAppFailure(describeAiSensyError(error) || "AiSensy connection failed", {
          secrets: [apiPassword],
        }),
      };
    }
  }

  try {
    // Verify credentials by fetching the phone number details
    const response = await fetch(
      `${GRAPH_API_BASE}/${config.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data?.error?.message || `API error ${response.status}`;
      return { success: false, message: errorMsg };
    }

    return {
      success: true,
      message: `Connected as "${data.verified_name}" (${data.display_phone_number}). Quality: ${data.quality_rating || "N/A"}`,
      phoneNumber: data.display_phone_number,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

// ============================================================
// Available WhatsApp message templates (local definitions)
// ============================================================

export const WHATSAPP_TEMPLATES = [
  {
    name: "winback_event_proximity",
    label: "Winback Event Proximity",
    // {{1}}, {{2}} — the same two, in the same order, the win-back engine sends.
    params: ["customerName", "eventDate"],
  },
  {
    name: "message_1",
    label: "Message 1",
    params: ["customerName"],
  },
  {
    name: "thank_you_static",
    label: "Thank You (Static)",
    params: [],
  },
  {
    name: "first_message",
    label: "First Message",
    params: [],
  },
] as const;

/**
 * A manual send's params in the order its template declares them. The send
 * forms build the record in the order fields were typed, and sendWhatsApp
 * maps it to {{1}}, {{2}}… by insertion order — so without this, typing the
 * date before the name would swap them in the customer's message.
 */
export function orderTemplateParams(
  templateName: string | null | undefined,
  params: Record<string, string> | undefined
): Record<string, string> | undefined {
  const declared: readonly string[] | undefined = WHATSAPP_TEMPLATES.find((t) => t.name === templateName)?.params;
  if (!params || !declared?.length) return params;
  const ordered: Record<string, string> = {};
  for (const key of declared) if (key in params) ordered[key] = params[key];
  for (const [key, value] of Object.entries(params)) if (!(key in ordered)) ordered[key] = value;
  return ordered;
}
