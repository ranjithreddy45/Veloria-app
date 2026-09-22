# 04 Enums and State Machines

`SCHEMA VERIFIED`

## Implemented Enums
- `CampaignStatus`: `DRAFT`, `SCHEDULED`, `SENDING`, `SENT`, `FAILED`, `CANCELLED`
- `ReferralStatus`: `PENDING`, `QUALIFIED`, `CONVERTED`, `EXPIRED`, `PAID`
- `ReferralSource`: `GUEST`, `PARTNER`, `EMPLOYEE`, `WEBSITE`
- `CommunicationDirection`: `INBOUND`, `OUTBOUND`
- `WhatsAppMessageStatus`: `SENT`, `DELIVERED`, `READ`, `FAILED`

## State Machines
1. **Email Campaign Lifecycle**: `DRAFT` -> `SCHEDULED` -> `SENDING` -> `SENT` (or `FAILED` / `CANCELLED`).
2. **Referral Lifecycle**: `PENDING` -> `QUALIFIED` -> `CONVERTED` -> `PAID` (or `EXPIRED`).
3. **Marketing Campaign Status**: Controlled by `isActive` boolean (Active vs Inactive).
