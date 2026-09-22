# 17 Public Tokenized Experiences & Security

`CODE VERIFIED`

## Tokenized Route Security Architecture

Public tokenized routes allow external users to interact with Veloria Grand without creating formal accounts.

### Comprehensive Tokenized Route Directory

| Route Path | Token Parameter | Database Model | Token Column | Expiration Field | Replay Protection |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/q/[token]` | `token` | `QuoteShareLink` | `token` | `expiresAt` | `isRevoked` flag |
| `/pay/[token]` | `token` | `PaymentLink` | `token` | `expiresAt` | Status set to `PAID` |
| `/pay/split/[token]` | `token` | `PaymentSplit` | `token` | `expiresAt` | Status set to `PAID` |
| `/sign/[token]` | `token` | `SignatureRequest` | `token` | `expiresAt` | Contract `isLocked` flag |
| `/hold/[token]` | `token` | `PublicHold` | `token` | `expiresAt` | Cron release handler |
| `/vendor-confirm/[token]`| `token` | `VendorAssignment` | `token` | `tokenExpiresAt` | Status set to `CONFIRMED` |
| `/rsvp/[token]` | `token` | `GuestInvitation` | `token` | `expiresAt` | `rsvpSubmittedAt` timestamp |
| `/visit/[token]` | `token` | `SiteVisit` | `token` | `expiresAt` | Status set to `COMPLETED` |
