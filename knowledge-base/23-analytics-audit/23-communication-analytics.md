# 23 Communications & Delivery Analytics

`CODE VERIFIED`

## Multi-Channel Messaging Analytics (`src/actions/communications.actions.ts`)

- **WhatsApp Delivery & Read Rate**: Percentage of outbound messages reaching `DELIVERED` and `READ` status.
- **Email Open & Click Rate**: Tracked via `EmailTrackingPixel` and `EmailTrackingEvent`.
- **Failed Deliveries**: Logs invalid phone numbers, bounced emails, and provider API errors.
- **Inbound Message Volume**: Volume of customer replies received via WhatsApp webhook (`/api/webhooks/whatsapp`).
