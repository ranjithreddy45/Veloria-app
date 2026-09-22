# 29 Portal Notifications, Email & WhatsApp Integration

`CODE VERIFIED`

## Cross-Channel Notification Triggers

Portal actions automatically trigger notifications across multiple channels via `communication.actions.ts`:

- **Quotation Shared**: Triggers WhatsApp & Email with link `/q/[token]`.
- **Payment Link Generated**: Triggers WhatsApp & Email with link `/pay/[token]`.
- **Contract Signature Request**: Triggers WhatsApp & Email with link `/sign/[token]`.
- **Vendor Work Order Assigned**: Triggers WhatsApp & Email with link `/vendor-confirm/[token]`.
- **Contract Signed / Payment Completed**: Triggers in-app `Notification` for internal sales/finance team.
