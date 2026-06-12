"use server";

import { checkRateLimit } from "@/lib/rate-limit";
import {
  normalizeOtpPhone,
  findActiveUserByPhone,
  createLoginOtp,
} from "@/lib/otp";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";

/**
 * Request a WhatsApp login code. Rate-limited and anti-enumeration: always
 * resolves success, but only actually sends a code when an active account
 * exists for that number. The plaintext code never leaves the server.
 */
export async function requestLoginOtp(
  rawPhone: string
): Promise<{ success: boolean; error?: string }> {
  const normalized = normalizeOtpPhone(rawPhone);
  if (normalized.length < 11) {
    return { success: false, error: "Enter a valid mobile number." };
  }

  // Max 3 codes per number per 5 minutes.
  const rl = checkRateLimit(`otp-request:${normalized}`, {
    maxRequests: 3,
    windowSeconds: 300,
  });
  if (!rl.success) {
    return {
      success: false,
      error: `Too many requests. Try again in ${rl.resetIn}s.`,
    };
  }

  const user = await findActiveUserByPhone(normalized);
  if (user) {
    const code = await createLoginOtp(normalized);
    await sendWhatsApp({
      to: normalized,
      message: `Your Veloria Grand login code is ${code}. It expires in 5 minutes. Never share this code with anyone.`,
    });
  }

  // Generic response either way (don't reveal whether the number is registered).
  return { success: true };
}
