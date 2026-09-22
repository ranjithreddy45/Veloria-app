# 26 - Booking Email & WhatsApp Communications

---

## 💬 Automated Messaging Integration

- **Email Service**: Managed via Resend SDK (`src/actions/communication.actions.ts`). Delivers HTML booking confirmations, PDF BEO sheets, and milestone tax invoices.
- **WhatsApp Cloud API**: Managed via Meta WhatsApp Cloud API (`src/actions/whatsapp-console.actions.ts`). Sends transactional templates:
  - `booking_hold_confirmation`: Date hold summary with expiry link.
  - `booking_confirmed_welcome`: Formal booking confirmation with Client Portal credentials.
  - `event_day_reminder`: Event host reminder 24 hours prior to event start.
