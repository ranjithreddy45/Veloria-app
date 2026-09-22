# 43 Finance Security & Data Protection

## Security Controls

- **Server Actions Guard**: Authentication context checked via `auth()` or session tokens.
- **Immutability**: No direct update or delete routes exposed for `FinJournalEntry` or `FinJournalLine`.
- **Webhook Security**: Razorpay webhook requests validated via HMAC SHA256 signatures.
