"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { getWhatsAppApiConfig } from "@/lib/integrations/whatsapp";
import {
  clientIpOf,
  isValidOtpPhone,
  issueLoginCode,
  maskPhone,
  normalizeOtpPhone,
  otpRateLimit,
  OTP_RESEND_SECONDS,
} from "@/lib/otp";

// ============================================================
// Request a WhatsApp sign-in code (customer app /app/welcome and staff
// /sign-in). Who actually gets a code is decided in src/lib/otp.ts.
//
// No enumeration: once the number is well-formed, within limits and WhatsApp
// is configured, every number gets the SAME response, and the eligibility
// check + WhatsApp send run after the response is sent (after()), so neither
// the body nor the response time says whether the number is on our records.
// Every refusal below depends only on the network, the number's request count
// or global configuration — never on whether the number is registered.
// ============================================================

export type RequestLoginOtpResult =
  | { success: true; message: string; resendInSeconds: number }
  | {
      success: false;
      error: string;
      reason: "INVALID_NUMBER" | "RATE_LIMITED" | "WHATSAPP_UNAVAILABLE";
    };

function waitText(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, seconds)} seconds`;
  return `${Math.ceil(seconds / 60)} minutes`;
}

export async function requestLoginOtp(rawPhone: string): Promise<RequestLoginOtpResult> {
  const normalized = normalizeOtpPhone(String(rawPhone ?? ""));
  if (!isValidOtpPhone(normalized)) {
    return {
      success: false,
      reason: "INVALID_NUMBER",
      error: "Enter a valid mobile number. Add the country code if it isn't an Indian number.",
    };
  }

  let ip: string | null = null;
  try {
    ip = clientIpOf(await headers());
  } catch {
    ip = null;
  }
  const byIp = otpRateLimit("request", "ip", ip);
  if (!byIp.success) {
    return {
      success: false,
      reason: "RATE_LIMITED",
      error: `Too many code requests from this network. Try again in ${waitText(byIp.resetIn)}.`,
    };
  }

  // Global, not per-number — safe to say plainly. The screen adds the venue's
  // contact options.
  const whatsapp = await getWhatsAppApiConfig();
  if (!whatsapp) {
    return {
      success: false,
      reason: "WHATSAPP_UNAVAILABLE",
      error: "Sign-in by WhatsApp isn't available right now.",
    };
  }

  // Applies to every number alike, registered or not.
  const byNumber = otpRateLimit("request", "number", normalized);
  if (!byNumber.success) {
    return {
      success: false,
      reason: "RATE_LIMITED",
      error: `Too many code requests for this number. Try again in ${waitText(byNumber.resetIn)}.`,
    };
  }

  after(async () => {
    try {
      const outcome = await issueLoginCode(normalized);
      if (outcome !== "SENT" && outcome !== "NOT_ELIGIBLE") {
        console.warn(`[otp] no code sent · ${outcome} · ${maskPhone(normalized)}`);
      }
    } catch (error) {
      console.error(`[otp] issuing a sign-in code failed · ${maskPhone(normalized)}`, error);
    }
  });

  return {
    success: true,
    resendInSeconds: OTP_RESEND_SECONDS,
    message: "If this number is on a booking or enquiry with us, a code is on its way on WhatsApp.",
  };
}
