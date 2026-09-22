# Phase 41: Final Risk Register

## Factual Risk Register
- **Risk**: Unscheduled Cron Endpoints
  - **Module**: System / Operations (14 Cron)
  - **Evidence**: 56 cron API endpoints exist, but production HTTP scheduler triggers must be configured.
  - **Mitigation**: Configure Vercel Cron or AWS EventBridge with `CRON_SECRET`.

- **Risk**: E-Invoice Live NIC Integration
  - **Module**: Invoicing (12 Invoicing)
  - **Evidence**: Prisma schema supports GST e-invoice fields, but live GSP API keys are pending client registration.
  - **Mitigation**: Register with GST Portal and configure GSP production API credentials.

- **Risk**: Biometric Hardware Network Boundary
  - **Module**: Attendance (15 Attendance)
  - **Evidence**: Biometric push API requires static IP whitelisting for hardware controllers.
  - **Mitigation**: Set up secure IP whitelist and SSL reverse proxy for hardware controllers.
