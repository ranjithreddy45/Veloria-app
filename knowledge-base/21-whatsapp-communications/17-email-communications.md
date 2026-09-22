# 17 Email Communications

`CODE VERIFIED`

- Sent via Resend API (`src/lib/email.ts`).
- `sendEmail()` handles single/multiple recipients, CC recipients, and subject formatting (`Subject — Veloria Grand`).
- Address Safety Check: Filters out reserved non-deliverable addresses (e.g. `wa-*@customer.invalid`).
- Fire-and-Forget: API errors logged without breaking caller flow.
