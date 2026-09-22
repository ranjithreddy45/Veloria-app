# 36 Automated Cron Jobs & Portal Expiration Handlers

`CODE VERIFIED`

## Cron Automation Affecting Portals

- `/api/cron/hold-expiry`: Runs hourly. Releases `PublicHold` slots where `expiresAt < new Date()` and `isReleased == false`.
- `/api/cron/quote-nudge`: Sends WhatsApp reminders for expiring quotes (`/q/[token]`).
- `/api/cron/payment-reminders`: Sends payment reminders with direct checkout link (`/pay/[token]`).
- `/api/cron/contract-reminders`: Sends contract signing reminders (`/sign/[token]`).
