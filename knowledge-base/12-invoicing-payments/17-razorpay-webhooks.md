# 17 - Razorpay Webhooks

---

## 📡 Webhook Route (`/api/payments/webhook`)

- **Signature Header**: `x-razorpay-signature`.
- **HMAC Check**: `crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex")`.
- **Timing-Safe Comparison**: `crypto.timingSafeEqual(expectedBuf, signatureBuf)` prevents timing attacks.
- **Events Handled**:
  - `payment.captured`: Calls `applyRazorpayCapture({ razorpayOrderId, razorpayPaymentId })`.
  - `payment.failed`: Flips pending payment status to `FAILED`.
- **Retry Behavior**: Returns HTTP `500` on transient errors so Razorpay retries delivery.
