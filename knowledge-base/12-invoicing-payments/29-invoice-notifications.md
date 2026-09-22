# 29 - Invoice Notifications

---

## 🔔 Invoice Dispatch Alerts

- **Invoice Sent Email**: `src/lib/email-templates/invoice-sent.ts` dispatches HTML email with PDF invoice link and Razorpay payment button.
- **In-App Notice**: Dispatches customer notice via `notifyCustomer()`.
