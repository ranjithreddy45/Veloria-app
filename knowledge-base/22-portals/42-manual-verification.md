# 42 Operator Manual Verification Guide

`CODE VERIFIED`

## Verification Procedures

1. **Client Portal Activation Test**:
   - Operator creates Contact in CRM -> Triggers "Send Portal Invite".
   - Open received email/WhatsApp link `/portal/activate?token=...`.
   - Set password -> Verify redirection to `/portal` dashboard.

2. **Public Quote One-Tap Accept Test**:
   - Open `/q/[token]` in incognito window.
   - Verify quote items, total price, and inclusions render correctly.
   - Click "Accept Quote" -> Verify quote status updates to ACCEPTED in DB.

3. **Public Contract E-Sign Test**:
   - Open `/sign/[token]`.
   - Draw signature on canvas -> Submit.
   - Verify contract `isLocked == true` and signature PNG stored in S3.
