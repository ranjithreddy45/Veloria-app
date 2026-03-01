// ============================================================
// WhatsApp Business API — Placeholder Module
// ============================================================
// All functions are placeholders that simulate WhatsApp Cloud API
// calls. They log a message and return a fake messageId. Replace
// with real WhatsApp Cloud API / Twilio integration later.

interface SendWhatsAppParams {
  to: string; // phone number
  template?: string; // template name
  message?: string; // custom message
  params?: Record<string, string>; // template params
}

/**
 * Send a WhatsApp message (placeholder).
 */
export async function sendWhatsApp(
  params: SendWhatsAppParams
): Promise<{ success: boolean; messageId?: string }> {
  console.log("[WhatsApp Placeholder] Sending to:", params.to);
  console.log("[WhatsApp Placeholder] Template:", params.template || "custom");
  console.log(
    "[WhatsApp Placeholder] Message:",
    params.message || "Using template"
  );

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    success: true,
    messageId: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

/**
 * Available WhatsApp message templates.
 */
export const WHATSAPP_TEMPLATES = [
  {
    name: "booking_confirmation",
    label: "Booking Confirmation",
    params: ["customerName", "eventDate", "venueName"],
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
  // Guest Invitation & Reminder Templates
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
