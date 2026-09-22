# 34 - Server Actions & API Registry

---

## ⚡ Complete Registry

| Action / Route | Source File | Purpose |
|---|---|---|
| `createInvoice` | `src/actions/invoice.actions.ts` | Generate new tax invoice |
| `sendInvoice` | `src/actions/invoice.actions.ts` | Formally issue invoice & post GL receivable |
| `recordPayment` | `src/actions/payment.actions.ts` | Record offline manual payment |
| `verifyPaymentProof` | `src/actions/payment.actions.ts` | Approve uploaded bank receipt proof |
| `createRazorpayOrder` | `src/actions/payment.actions.ts` | Mint Razorpay Order for checkout |
| `verifyRazorpayPayment` | `src/actions/payment.actions.ts` | Verify HMAC & capture payment |
| `/api/payments/create-order` | `src/app/api/payments/create-order/route.ts` | REST endpoint for Razorpay order |
| `/api/payments/verify` | `src/app/api/payments/verify/route.ts` | REST endpoint for payment verification |
| `/api/payments/webhook` | `src/app/api/payments/webhook/route.ts` | Razorpay event webhook handler |
