# 14 - Razorpay Integration

---

## 💳 Gateway Credentials & API Setup

- **SDK Configuration**: `src/lib/payments/razorpay-creds.ts`.
- **Environment Variables**:
  - `RAZORPAY_KEY_ID`: Public API Key ID
  - `RAZORPAY_KEY_SECRET`: Secret API Key
  - `RAZORPAY_WEBHOOK_SECRET`: Webhook verification secret
- **Currency**: `INR` (Indian Rupee).
- **Paise Conversion**: Amounts converted via `toPaise(rupees)` (`rupees * 100`) for API payloads.
