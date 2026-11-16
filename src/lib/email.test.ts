import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isEmailConfigured, sendEmail } from "./email";

describe("email client (SMTP & Resend)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.GOOGLE_EMAIL;
    delete process.env.GOOGLE_APP_PASSWORD;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reports unconfigured when no email credentials exist", () => {
    expect(isEmailConfigured()).toBe(false);
  });

  it("reports configured when RESEND_API_KEY is present", () => {
    process.env.RESEND_API_KEY = "re_test_123";
    expect(isEmailConfigured()).toBe(true);
  });

  it("reports configured when Google Business Email (SMTP) credentials are present", () => {
    process.env.SMTP_USER = "events@veloriagrand.com";
    process.env.SMTP_PASS = "abcd efgh ijkl mnop";
    expect(isEmailConfigured()).toBe(true);
  });

  it("returns { success: false, error: 'Email not configured' } when sending without credentials", async () => {
    const res = await sendEmail({
      to: "customer@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Email not configured");
  });

  it("filters out RFC 2606 .invalid addresses", async () => {
    const res = await sendEmail({
      to: "wa-919876543210@customer.invalid",
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe("No deliverable recipient");
  });
});
