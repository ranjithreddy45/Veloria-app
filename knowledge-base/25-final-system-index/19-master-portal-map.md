# Phase 19: Master Portal Map

## 1. Portal Architectural Boundaries
- **Client Portal (`/portal/*`)**: Authenticated client workspace to view quotations, accept holds, sign contracts, download invoices, and pay via Razorpay.
- **Vendor Portal (`/vendor-portal/*`)**: Authenticated supplier workspace to submit bids, review work orders, update delivery status, and submit AP bills.
- **Public Experience Links**: Cryptographically secured public links (`/q/[token]`, `/sign/[token]`, `/pay/[token]`, `/hold/[token]`) allowing token-based actions without full user registration.
- **Employee Self-Service**: Embedded HR portal for attendance, leave submission, and payslip downloads.
