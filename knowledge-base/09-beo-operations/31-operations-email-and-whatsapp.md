# 31 - Operations Email & WhatsApp Communications

---

## 💬 Automated Messaging Integration

- **Resend Email Engine**: Dispatches published BEO function sheet PDFs and vendor work order agreements.
- **WhatsApp Cloud API (`src/actions/whatsapp-console.actions.ts`)**: Sends operational alerts:
  - `beo_published_alert`: Dispatches BEO link to Event Coordinator and Head Chef.
  - `vendor_workorder_reminder`: Dispatches setup timing reminder to external contractors.
  - `readiness_warning`: Alerts Operations Head of un-ready readiness scores.
