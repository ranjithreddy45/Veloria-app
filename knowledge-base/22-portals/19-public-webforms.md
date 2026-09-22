# 19 Public Webforms & Lead Capture Engine (`/form/[slug]`, `/api/webforms/[slug]`)

`CODE VERIFIED`

## Webform Processing Pipeline (`src/actions/webform.actions.ts`)

Public landing pages embed dynamic lead forms via `/form/[slug]` or direct POST requests to `/api/webforms/[slug]`.

### Submission Security & Processing Steps
1. **Validation**: Validates request body using Zod schema.
2. **Honeypot & Bot Defense**: Drops requests containing hidden honeypot fields.
3. **Lead Deduplication**: Matches existing `Lead` / `Contact` by phone or email.
4. **Attribution**: Captures `utm_source`, `utm_medium`, `utm_campaign`, `gclid`, and referrer.
5. **Notification**: Triggers instant sales executive assignment notification via WhatsApp/Email.
