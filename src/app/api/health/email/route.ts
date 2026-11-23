import { NextResponse } from "next/server";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const testTo = url.searchParams.get("test");

  // Ensure env is loaded if running in standalone mode
  if (typeof window === "undefined" && !process.env.SMTP_USER) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("dotenv").config();
    } catch {}
  }

  const smtpUser = process.env.SMTP_USER?.trim() || process.env.GOOGLE_EMAIL?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim() || process.env.GOOGLE_APP_PASSWORD?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT) || 465;

  const diagnostics = {
    configured: isEmailConfigured(),
    hasSmtpUser: Boolean(smtpUser),
    smtpUserValue: smtpUser ? `${smtpUser.slice(0, 4)}***@${smtpUser.split("@")[1] || ""}` : null,
    hasSmtpPass: Boolean(smtpPass),
    smtpHost,
    smtpPort,
    hasResend: Boolean(process.env.RESEND_API_KEY?.trim()),
    timestamp: new Date().toISOString(),
  };

  let verifyResult: unknown = null;
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 8000,
      });
      await transporter.verify();
      verifyResult = { ok: true, message: "SMTP connection verified successfully" };
    } catch (e) {
      verifyResult = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        code: (e as Record<string, unknown>).code,
      };
    }
  }

  let sendResult: unknown = null;
  if (testTo) {
    try {
      sendResult = await sendEmail({
        to: testTo,
        subject: "Veloria Grand Production Email Diagnostic Test",
        html: "<p>This is a live test from the Veloria Grand production server.</p>",
      });
    } catch (e) {
      sendResult = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    diagnostics,
    verifyResult,
    sendResult,
  });
}
