# 16 - Razorpay Payment Verification

---

## 🔐 Signature Verification (`verifyRazorpayPayment`)

Browser checkout returns `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`.

```typescript
const expectedSignature = crypto
  .createHmac("sha256", secret)
  .update(orderId + "|" + paymentId)
  .digest("hex");

if (expectedSignature === signature) {
  await applyRazorpayCapture({ razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature });
}
```
