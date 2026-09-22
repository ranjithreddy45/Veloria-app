# 30 Razorpay Payment Link Integration & Webhooks

`CODE VERIFIED`

## Razorpay Checkout & Webhook Integration

1. Client opens `/pay/[token]`.
2. Page calls `/api/payments/create-order` -> Backend calls Razorpay Orders API -> Returns `razorpayOrderId`.
3. Client completes payment in Razorpay modal.
4. Razorpay sends signed webhook payload to `/api/payments/webhook`.
5. Webhook handler verifies `x-razorpay-signature` using HMAC SHA-256.
6. Updates `Payment.status = 'SUCCESS'`, `Invoice.amountPaid += payment.amount`, updates `Invoice.status`.
