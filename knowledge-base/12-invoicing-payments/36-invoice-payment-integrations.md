# 36 - System Integrations

---

## 🔌 Subsystem Integrations

| System | Entry Point | Data Flow |
|---|---|---|
| **Razorpay Gateway** | `applyRazorpayCapture` | Mints orders, verifies HMAC signatures, captures online payments |
| **General Ledger** | `receivables.ts` | Posts Dr AR / Cr Revenue on issue; Dr Cash / Cr AR on payment |
| **Resend Email** | `email-templates/` | Dispatches Tax Invoice PDFs and Payment Receipts |
| **WhatsApp API** | `payment-reminders.ts` | Dispatches payment links and setup notifications |
