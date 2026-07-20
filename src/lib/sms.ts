// ============================================================
// SMS — thin fire-and-forget wrapper over the real provider integration.
// ============================================================
// Historically this was a console.log placeholder, which meant every caller that
// imported it (event reminders, booking confirmations, ops assignments) SILENTLY
// never sent an SMS — even when MSG91/Twilio was configured. It now delegates to
// the real provider-agnostic sender in @/lib/integrations/sms (which handles the
// unconfigured no-op, phone normalisation, and DB logging), so those flows send
// for real once SMS_PROVIDER + keys are set.
//
// Design: fire-and-forget — SMS failures never break the main flow.

import { sendSms, isSmsConfigured } from "@/lib/integrations/sms";

interface SendSMSParams {
  to: string;
  message: string;
}

interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Send an SMS via the configured provider. Never throws. */
export async function sendSMS({ to, message }: SendSMSParams): Promise<SendSMSResult> {
  const res = await sendSms(to, message);
  return { success: res.success, messageId: res.providerId, error: res.error };
}

/** Send SMS without awaiting; errors are swallowed and logged. */
export function sendSMSFireAndForget(params: SendSMSParams): void {
  sendSms(params.to, params.message).catch((err) => {
    console.error("[SMS_FIRE_AND_FORGET_ERROR]", err);
  });
}

/** Re-export the config check so callers can gate UI/logic on live SMS. */
export { isSmsConfigured };
