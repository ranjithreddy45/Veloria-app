# Phase 25: Master Gaps & Limitations

## 1. Factual System Gaps
- **Cron Deployment**: 56 cron API handlers exist in source code, but production deployment requires configuring external scheduler triggers with `CRON_SECRET`.
- **E-Invoicing Production Integration**: GST e-invoice schema fields exist, but live sandbox/production API keys require client portal registration.
- **Biometric Hardware Sync**: Hardware sync API endpoint expects POST payloads from ZKTeco/Hikvision devices; network bridge setup is hardware-dependent.
- **Banking Direct Payouts**: Payment records support manual entry and Razorpay webhook capture, but direct host-to-host bank API transfers require institutional bank setup.
