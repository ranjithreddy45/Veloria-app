# 07 Client Quotation Viewer & One-Tap Accept (`/q/[token]`)

`CODE VERIFIED`

## Public Tokenized Quotation Engine (`src/actions/quote-share-public.actions.ts`)

When a sales executive shares a quotation, the system generates a secure `QuoteShareLink` with a 128-bit cryptographic token.

```
Sales Executive -> Create Share Link -> QuoteShareLink (token) -> WhatsApp/Email Link
Client Click -> GET /q/[token] -> Validate Expiration -> Render Interactive Quote
Client Action -> Accept / One-Tap Pay -> Update Quote Status -> Create Booking/Invoice
```

### Key Security & Business Logic

1. **Token Lookup (`getPublicQuoteByToken`)**:
   - Queries `QuoteShareLink` where `token == params.token`.
   - Verifies `expiresAt > new Date()` and `isRevoked == false`.
   - Increments `viewCount` and logs `QuoteView` record with client IP & User-Agent.

2. **One-Tap Acceptance (`acceptQuoteOneTap`)**:
   - Updates `Quote.status` to `ACCEPTED`.
   - Auto-generates formal `Booking` draft or converts quote into active booking.
   - Triggers automated confirmation email/WhatsApp notification to client and assigned sales executive.
