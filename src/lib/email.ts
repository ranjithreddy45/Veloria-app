// ============================================================
// Email Client — Google Workspace / SMTP & Resend Integration
// ============================================================
// Fire-and-forget pattern: email failures never break main flow.

import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";

// Lazy-init to avoid throwing at module load when credentials are empty
let _resend: Resend | null = null;
let _transporter: Transporter | null = null;

export function isEmailConfigured(): boolean {
  if (process.env.RESEND_API_KEY?.trim()) return true;
  const user = process.env.SMTP_USER?.trim() || process.env.GOOGLE_EMAIL?.trim();
  const pass = process.env.SMTP_PASS?.trim() || process.env.GOOGLE_APP_PASSWORD?.trim();
  return Boolean(user && pass);
}

function getTransporter(): Transporter | null {
  const user = process.env.SMTP_USER?.trim() || process.env.GOOGLE_EMAIL?.trim();
  const pass = process.env.SMTP_PASS?.trim() || process.env.GOOGLE_APP_PASSWORD?.trim();
  if (!user || !pass) return null;

  if (!_transporter) {
    const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : port === 465;

    _transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }
  return _transporter;
}

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY?.trim()) return null;
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY.trim());
  }
  return _resend;
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Veloria Grand";

function getFromEmail(smtpUser?: string): string {
  if (process.env.EMAIL_FROM?.trim()) return process.env.EMAIL_FROM.trim();
  if (smtpUser) return `${APP_NAME} <${smtpUser}>`;
  return `${APP_NAME} <noreply@${process.env.EMAIL_DOMAIN || "veloriagrand.com"}>`;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  /** Optional carbon-copy recipients (e.g. HR looped in on a notification). */
  cc?: string | string[];
}

/**
 * Send an email via Google Business Email (SMTP) or Resend.
 * Returns { success, messageId } or { success: false, error }.
 * Designed to be called fire-and-forget — wrap in try/catch in callers.
 */
export async function sendEmail({ to, subject, html, cc }: SendEmailParams) {
  // Never send to reserved non-deliverable addresses (RFC 2606 ".invalid"):
  // customer logins created from a WhatsApp number get wa-<digits>@customer.invalid.
  const deliverable = (list?: string | string[]) =>
    (Array.isArray(list) ? list : list ? [list] : []).filter((a) => !/\.invalid>?\s*$/i.test(a));
  const toList = deliverable(to);
  const ccList = deliverable(cc);
  if (toList.length === 0) return { success: false, error: "No deliverable recipient" };

  const emailSubject = subject.includes(APP_NAME) ? subject : `${subject} — ${APP_NAME}`;

  // 1. Google Business Email / SMTP (preferred when configured)
  const transporter = getTransporter();
  const smtpUser = process.env.SMTP_USER?.trim() || process.env.GOOGLE_EMAIL?.trim();
  if (transporter && smtpUser) {
    try {
      const from = getFromEmail(smtpUser);
      const info = await transporter.sendMail({
        from,
        to: toList,
        ...(ccList.length > 0 ? { cc: ccList } : {}),
        subject: emailSubject,
        html,
      });

      console.log("[EMAIL_SENT_SMTP]", { to: toList, subject: emailSubject, messageId: info.messageId });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error("[EMAIL_SMTP_ERROR]", err);
      return { success: false, error: err instanceof Error ? err.message : "Failed to send email via SMTP" };
    }
  }

  // 2. Resend provider (fallback if configured)
  const resend = getResend();
  if (resend) {
    try {
      const from = getFromEmail();
      const { data, error } = await resend.emails.send({
        from,
        to: toList,
        ...(ccList.length > 0 ? { cc: ccList } : {}),
        subject: emailSubject,
        html,
      });

      if (error) {
        console.error("[EMAIL_RESEND_ERROR]", error);
        return { success: false, error: error.message };
      }

      console.log("[EMAIL_SENT_RESEND]", { to: toList, subject: emailSubject, messageId: data?.id });
      return { success: true, messageId: data?.id };
    } catch (err) {
      console.error("[EMAIL_RESEND_ERROR]", err);
      return { success: false, error: "Failed to send email via Resend" };
    }
  }

  console.warn("[EMAIL] Neither Google Business Email (SMTP) nor RESEND_API_KEY is configured — skipping email");
  return { success: false, error: "Email not configured" };
}
