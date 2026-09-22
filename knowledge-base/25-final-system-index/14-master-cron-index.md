# Phase 14: Master Cron Index

## 1. Documented Cron Endpoints (56 Total Endpoints)
The system codebase contains 56 API route handlers under `/api/cron/*` designed for background scheduled execution.

## 2. Key Cron Endpoint Examples
- `/api/cron/sla-check`: Evaluates lead SLA timers and escalates breached leads.
- `/api/cron/hold-expiration`: Clears expired soft-hold tokens and releases venue availability.
- `/api/cron/payroll-accrual`: Calculates monthly payroll accruals on the final day of the month.
- `/api/cron/inventory-alerts`: Scans reorder thresholds and alerts procurement managers.
- `/api/cron/contract-reminders`: Sends automated WhatsApp/Email reminders for unsigned contracts.

## 3. Deployment vs Endpoint Inventory Distinction
- **Actual Codebase Inventory**: 56 endpoints defined in route files.
- **Deployment Status**: Requires production scheduler configuration (e.g. Vercel Cron, AWS EventBridge, or external HTTP trigger) supplying the `CRON_SECRET` authorization header.
