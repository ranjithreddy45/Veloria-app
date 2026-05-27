// ============================================================
// Email Client — Resend Integration
// ============================================================
// Fire-and-forget pattern: email failures never break main flow.

import { Resend } from "resend";

// Lazy-init to avoid throwing at module load when API key is empty
let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Veloria Grand";
const FROM_EMAIL =
  process.env.EMAIL_FROM ||
  `${APP_NAME} <noreply@${process.env.EMAIL_DOMAIN || "veloriagrand.com"}>`;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via Resend. Returns { success, messageId } or { success: false, error }.
 * Designed to be called fire-and-forget — wrap in try/catch in callers.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const resend = getResend();
  if (!resend) {
    console.warn("[EMAIL] RESEND_API_KEY not configured — skipping email");
    return { success: false, error: "Email not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: subject.includes(APP_NAME) ? subject : `${subject} — ${APP_NAME}`,
      html,
    });

    if (error) {
      console.error("[EMAIL_ERROR]", error);
      return { success: false, error: error.message };
    }

    console.log("[EMAIL_SENT]", { to, subject, messageId: data?.id });
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[EMAIL_ERROR]", err);
    return { success: false, error: "Failed to send email" };
  }
}
