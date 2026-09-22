# 39 - Feature Dependency Map

---

## 🔗 Feature Dependency Matrix

| Component | Depends On | Required By | Status |
|---|---|---|---|
| **Invoice Calculation** | `src/lib/invoice-calc.ts` | Invoice Creation, PDF rendering | `AUTOMATIC` |
| **Razorpay Verification** | HMAC SHA-256 Crypto | Payment Capture Engine | `AUTOMATIC` |
| **Payment Capture Engine** | `applyRazorpayCapture` | Webhook, Verification API | `AUTOMATIC` |
| **GL Receivables Bridge** | `receivables.ts`, `FinAccount` | General Ledger Accounting | `AUTOMATIC` |
