# 18 Referral System

`CODE VERIFIED`

- `ReferralPartner`: Tracks B2B partners (Planners, Decorators, Vendors, Guests, Employees) with unique code (`code`).
- Public Referral Landing: `/refer/<code>` allows external referral submissions (`submitPublicReferral`).
- Rate limiting: Max 10 requests / 10 mins per code and max 8 requests / 10 mins per IP. Honeypot protection via hidden `website` input field.
- `ReferralPortalSubmission` & `ReferralPayout`: Track referral lead progression to `WON` booking and manage payout commissions.
