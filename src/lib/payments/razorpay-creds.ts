// ============================================================
// Razorpay credentials — single, trimmed point of truth.
// ------------------------------------------------------------
// Secrets pasted into a dashboard / .env very commonly pick up a trailing
// newline or stray surrounding spaces. Razorpay then rejects the key pair with
// a 401 "Authentication failed" even though the value "looks" right. Trimming
// at the one place every caller reads from makes that whole class of failure
// impossible, regardless of how the env var was entered.
// ============================================================

function clean(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** Live/Test key id (rzp_live_… / rzp_test_…), trimmed. */
export function razorpayKeyId(): string | undefined {
  return clean(process.env.RAZORPAY_KEY_ID);
}

/** Key secret, trimmed. */
export function razorpayKeySecret(): string | undefined {
  return clean(process.env.RAZORPAY_KEY_SECRET);
}

/** Webhook signing secret, trimmed. */
export function razorpayWebhookSecret(): string | undefined {
  return clean(process.env.RAZORPAY_WEBHOOK_SECRET);
}

/** True only when both the key id and secret are present. */
export function razorpayConfigured(): boolean {
  return !!(razorpayKeyId() && razorpayKeySecret());
}

/**
 * Non-sensitive fingerprint of the configured credentials, safe to log for
 * diagnosing 401s. The key id is NOT a secret (it's sent to the browser
 * checkout); the secret is reduced to its length only — never its value.
 */
export function razorpayCredFingerprint() {
  const id = razorpayKeyId();
  const secret = razorpayKeySecret();
  return {
    keyIdPresent: !!id,
    keyIdMode: id?.startsWith("rzp_live_")
      ? "live"
      : id?.startsWith("rzp_test_")
      ? "test"
      : id
      ? "unknown-prefix"
      : "missing",
    keyId: id ?? null, // safe: public value
    keyIdLen: id?.length ?? 0,
    secretPresent: !!secret,
    secretLen: secret?.length ?? 0,
  };
}
