// ============================================================
// SMS Integration — Provider-agnostic (MSG91 | Twilio)
// ============================================================
// Mirrors the WhatsApp / Resend graceful-unconfigured pattern: if no
// provider is configured the call is a clean no-op that returns an error
// string instead of throwing. Every send attempt (success OR failure) is
// recorded as an SmsMessage row so the UI/stats always reconcile with the DB.
//
// Env configuration:
//   SMS_PROVIDER          "MSG91" | "TWILIO"
//   MSG91_AUTH_KEY        (MSG91) auth key
//   MSG91_SENDER_ID       (MSG91) 6-char approved sender/DLT header
//   TWILIO_ACCOUNT_SID    (Twilio) account SID
//   TWILIO_AUTH_TOKEN     (Twilio) auth token
//   TWILIO_SMS_FROM       (Twilio) from number in E.164, e.g. +15551234567

import { prisma } from "@/lib/prisma";

type SmsProvider = "MSG91" | "TWILIO";

export interface SendSmsResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

interface SendSmsOpts {
  contactId?: string;
}

// ============================================================
// Configuration helpers
// ============================================================

/**
 * Returns the active SMS provider if its required env keys are present,
 * otherwise null. Used by callers and the UI to decide whether SMS is live.
 */
export function getSmsProvider(): SmsProvider | null {
  const provider = (process.env.SMS_PROVIDER || "").toUpperCase();

  if (provider === "MSG91") {
    if (process.env.MSG91_AUTH_KEY && process.env.MSG91_SENDER_ID) {
      return "MSG91";
    }
    return null;
  }

  if (provider === "TWILIO") {
    if (
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_SMS_FROM
    ) {
      return "TWILIO";
    }
    return null;
  }

  return null;
}

/**
 * True when a provider is selected AND its credentials are set.
 * Cheap, synchronous — safe to call from server components / the UI.
 */
export function isSmsConfigured(): boolean {
  return getSmsProvider() !== null;
}

// ============================================================
// Normalize phone number to E.164-ish international form
// ============================================================

function normalizePhone(phone: string): string {
  // Strip spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-()]+/g, "");

  const hadPlus = cleaned.startsWith("+");
  if (hadPlus) cleaned = cleaned.slice(1);

  // Leading 0 → assume Indian trunk prefix, swap for country code 91
  if (cleaned.startsWith("0")) {
    cleaned = "91" + cleaned.slice(1);
  }

  // Only a 10-digit number in India's mobile range (first digit 6-9) may be
  // assumed Indian. A US/UK number is also 10 digits but starts 2-5, and
  // prepending 91 to it sends the message to a different person's phone.
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    cleaned = "91" + cleaned;
  }

  // Twilio requires a leading +; MSG91 accepts the bare international number.
  // We return the +-prefixed form and let the MSG91 path strip it.
  return "+" + cleaned;
}

// ============================================================
// Public API
// ============================================================

/**
 * Send an SMS. Provider-agnostic. Always writes an SmsMessage row:
 *   - SENT   (+providerId) on success
 *   - FAILED (+failureReason) on failure or when unconfigured
 *
 * Designed to be called fire-and-forget — never throws.
 */
export async function sendSms(
  to: string,
  body: string,
  opts?: SendSmsOpts
): Promise<SendSmsResult> {
  const provider = getSmsProvider();
  const normalized = normalizePhone(to);

  // Graceful no-op when unconfigured (mirrors WhatsApp/Resend).
  if (!provider) {
    const error =
      "SMS not configured — set SMS_PROVIDER + provider keys in env.";
    await recordSms({
      to: normalized,
      body,
      contactId: opts?.contactId,
      status: "FAILED",
      failureReason: error,
    });
    return { success: false, error };
  }

  let result: SendSmsResult;
  try {
    result =
      provider === "MSG91"
        ? await sendViaMsg91(normalized, body)
        : await sendViaTwilio(normalized, body);
  } catch (err) {
    result = {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  // Record the attempt regardless of outcome.
  await recordSms({
    to: normalized,
    body,
    contactId: opts?.contactId,
    status: result.success ? "SENT" : "FAILED",
    providerId: result.providerId,
    failureReason: result.success ? undefined : result.error,
  });

  return result;
}

// ============================================================
// Persistence — single place that writes the SmsMessage row
// ============================================================

async function recordSms(params: {
  to: string;
  body: string;
  contactId?: string;
  status: "SENT" | "FAILED";
  providerId?: string;
  failureReason?: string;
}): Promise<void> {
  try {
    await prisma.smsMessage.create({
      data: {
        direction: "OUTBOUND",
        content: params.body,
        status: params.status,
        toNumber: params.to,
        contactId: params.contactId ?? null,
        providerId: params.providerId ?? null,
        failureReason: params.failureReason ?? null,
      },
    });
  } catch (err) {
    // Never let a logging failure break the caller.
    console.error("[SMS] Failed to record message row:", err);
  }
}

// ============================================================
// Provider: MSG91 (Flow / send SMS API)
// ============================================================
// Docs: https://docs.msg91.com/ — uses the simple v2 sendsms endpoint.

async function sendViaMsg91(
  to: string,
  body: string
): Promise<SendSmsResult> {
  const authKey = process.env.MSG91_AUTH_KEY!;
  const senderId = process.env.MSG91_SENDER_ID!;

  // MSG91 wants the bare international number (no leading +).
  const mobile = to.replace(/^\+/, "");

  const response = await fetch("https://api.msg91.com/api/v2/sendsms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
    body: JSON.stringify({
      sender: senderId,
      route: "4", // transactional route
      country: "0", // numbers already carry country code
      sms: [{ message: body, to: [mobile] }],
    }),
  });

  const data = await response.json().catch(() => ({}));

  // MSG91 returns { type: "success", message: "<request-id>" } on success.
  if (!response.ok || data?.type === "error") {
    const error =
      data?.message || data?.msg || `MSG91 error ${response.status}`;
    console.error("[SMS][MSG91] Send failed:", JSON.stringify(data));
    return { success: false, error: String(error) };
  }

  return { success: true, providerId: data?.message ? String(data.message) : undefined };
}

// ============================================================
// Provider: Twilio (Messages API)
// ============================================================
// Docs: https://www.twilio.com/docs/sms/api/message-resource

async function sendViaTwilio(
  to: string,
  body: string
): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_SMS_FROM!;

  // Twilio uses form-encoded body and HTTP Basic auth (SID:token).
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: params.toString(),
    }
  );

  const data = await response.json().catch(() => ({}));

  // Twilio returns { sid: "SM...", ... } on success, { message, code } on error.
  if (!response.ok || data?.error_code || data?.code) {
    const error = data?.message || `Twilio error ${response.status}`;
    console.error("[SMS][Twilio] Send failed:", JSON.stringify(data));
    return { success: false, error: String(error) };
  }

  return { success: true, providerId: data?.sid ? String(data.sid) : undefined };
}
