# Phase 15: Master State Machines

## 1. Core State Transition Rules
- **Lead Lifecycle**: `NEW` -> `CONTACTED` -> `QUALIFIED` -> `PROPOSAL_SENT` -> `NEGOTIATION` -> `WON` / `LOST`.
- **Quotation Lifecycle**: `DRAFT` -> `SENT` -> `ACCEPTED` / `REJECTED` / `EXPIRED`.
- **Contract Lifecycle**: `DRAFT` -> `SENT` -> `PARTIALLY_SIGNED` -> `FULLY_SIGNED` / `CANCELLED`.
- **Booking Lifecycle**: `HOLD` -> `TENTATIVE` -> `CONFIRMED` -> `IN_PROGRESS` -> `COMPLETED` / `CANCELLED`.
- **BEO Read-Only State**: `DRAFT` -> `PENDING_REVIEW` -> `APPROVED` -> `LOCKED` (Immutable editing lock).
- **Invoice Lifecycle**: `DRAFT` -> `ISSUED` -> `PARTIALLY_PAID` -> `PAID` / `CANCELLED`.
- **Payroll Cycle**: `DRAFT` -> `CALCULATED` -> `APPROVED` -> `DISBURSED` -> `POSTED_TO_GL`.
- **Expense Claim**: `SUBMITTED` -> `APPROVED` -> `AP_BILL_POSTED` -> `PAID`.
