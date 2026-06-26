// ============================================================
// WhatsApp Business API — Meta Cloud API Integration
// ============================================================
// Sends messages via Meta WhatsApp Cloud API v21.0
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

import { prisma } from "@/lib/prisma";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ============================================================
// Types
// ============================================================

export interface WhatsAppApiConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  appSecret?: string | null;
  verifyToken?: string;
}

interface SendWhatsAppParams {
  to: string; // phone number (international format)
  template?: string; // template name
  message?: string; // custom text message
  params?: Record<string, string>; // template params
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
      accessToken: config.accessToken,
      phoneNumberId: config.phoneNumberId,
      businessAccountId: config.businessAccountId,
      appSecret: config.appSecret,
      verifyToken: config.verifyToken,
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

  // If it's 10 digits, assume Indian number
  if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    cleaned = "91" + cleaned;
  }

  return cleaned;
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

  try {
    // If a template is specified, send template message
    if (params.template) {
      return await sendTemplateMessage(config, to, params.template, params.params);
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
  params?: Record<string, string>
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
            language: { code: "en" },
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

export async function testWhatsAppConnection(
  config: WhatsAppApiConfig
): Promise<{ success: boolean; message: string; phoneNumber?: string }> {
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
    name: "booking_confirmation",
    label: "Booking Confirmation",
    params: ["customerName", "eventDate", "venueName"],
  },
  {
    name: "review_request",
    label: "Review Request",
    params: ["customerName", "eventName", "reviewLink"],
  },
  {
    name: "payment_reminder",
    label: "Payment Reminder",
    params: ["customerName", "amount", "dueDate"],
  },
  {
    name: "event_reminder",
    label: "Event Reminder",
    params: ["customerName", "eventDate", "eventTime"],
  },
  {
    name: "thank_you",
    label: "Thank You",
    params: ["customerName", "eventType"],
  },
  {
    name: "quote_sent",
    label: "Quote Sent",
    params: ["customerName", "quoteNumber"],
  },
  {
    name: "guest_invitation",
    label: "Guest Invitation",
    params: ["guestName", "eventName", "eventDate", "eventTime", "venueName", "hostName", "rsvpLink"],
  },
  {
    name: "save_the_date",
    label: "Save the Date",
    params: ["guestName", "eventName", "eventDate", "venueName", "daysUntil"],
  },
  {
    name: "excitement_builder",
    label: "Excitement Builder",
    params: ["guestName", "eventName", "eventDate", "daysUntil"],
  },
  {
    name: "final_countdown",
    label: "Final Countdown",
    params: ["guestName", "eventName", "eventDate", "eventTime", "venueName"],
  },
  {
    name: "tomorrow_reminder",
    label: "Tomorrow Reminder",
    params: ["guestName", "eventName", "eventTime", "venueName", "dressCode"],
  },
  {
    name: "day_of_welcome",
    label: "Day-Of Welcome",
    params: ["guestName", "eventName", "eventTime", "venueName", "parkingInfo"],
  },
] as const;
