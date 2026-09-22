# 20 Referral Partner Experience & Payouts (`/refer/[code]`)

`CODE VERIFIED`

## Referral Engine Architecture (`src/actions/referral-portal.actions.ts`)

Referral partners (Wedding Planners, Event Agencies, Corporate Promoters) drive leads via unique referral codes (`/refer/[code]`).

### Referral Flow
1. Partner registers -> Receives code `REF-PLANNERS-100`.
2. Visitor lands on `/refer/REF-PLANNERS-100` -> Sets cookie `veloria_ref_code`.
3. Visitor submits lead or booking -> `ReferralPortalSubmission` created (`partnerId`, `leadId`).
4. Upon booking milestone/payment, `ReferralPayout` generated for partner.
