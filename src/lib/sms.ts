// ============================================================
// SMS Service (Placeholder)
// ============================================================
// Placeholder implementation that logs SMS messages.
// Replace with Twilio or other SMS provider later.
//
// Design: fire-and-forget — SMS failures never break main flow.

interface SendSMSParams {
  to: string;
  message: string;
}

interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an SMS message. Returns { success, messageId } or { success: false, error }.
 * Currently a placeholder that logs to console instead of sending real SMS.
 * Designed to be called fire-and-forget — never throws.
 */
export async function sendSMS({
  to,
  message,
}: SendSMSParams): Promise<SendSMSResult> {
  try {
    // Placeholder: log to console instead of sending real SMS
    console.log(`[SMS Placeholder] To: ${to}`);
    console.log(`[SMS Placeholder] Message: ${message}`);
    console.log(`[SMS Placeholder] ---`);

    // Generate a mock message ID
    const messageId = `sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return { success: true, messageId };
  } catch (error) {
    console.error("[SMS] Failed to send:", error);
    return { success: false, error: "Failed to send SMS" };
  }
}

/**
 * Send SMS without awaiting. Errors are swallowed and logged.
 * Mirrors the fire-and-forget pattern used by `notify()` in notify.ts.
 */
export function sendSMSFireAndForget(params: SendSMSParams): void {
  sendSMS(params).catch((err) => {
    console.error("[SMS_FIRE_AND_FORGET_ERROR]", err);
  });
}
