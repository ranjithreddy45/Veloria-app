# 18 Public Hold & Booking Experience (`/hold`, `/hold/[token]`)

`CODE VERIFIED`

## Public Venue Hold Engine (`src/actions/public-hold.actions.ts`)

Prospective clients can lock an event date for 24-48 hours by placing a temporary hold online.

```
1. Visitor browses /hold or /app/venues
2. Selects Date & Venue -> System checks real-time slot availability
3. Pays nominal Hold Fee (e.g. ₹10,000) via Razorpay
4. System creates PublicHold record (expiresAt = Date.now() + 48 hours)
5. Hold Token generated -> Redirected to /hold/[token]
6. Cron /api/cron/hold-expiry releases slot if not converted into formal booking
```
