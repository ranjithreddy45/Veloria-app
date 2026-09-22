# Complete Quotation Feature Index

## Overview

Authoritative feature catalog for all quotation capabilities with immutable feature identifiers.

---

## Feature Catalog

| Feature ID | Feature Name | Primary Route | Primary Action / API | Primary Model | Status |
|---|---|---|---|---|---|
| `QUOTE-001` | Quotation Builder | `/quotations/new` | `createSalesQuotation()` | `SalesQuotation` | CODE VERIFIED |
| `QUOTE-002` | Tier Builder (Silver/Gold/Platinum) | `/quotations/new` | `saveQuoteTiers()` | `QuoteTier` | CODE VERIFIED |
| `QUOTE-003` | Dynamic Yield Pricing | `/pricing/yield` | `applyYieldRules()` | `PricingRule` | CODE VERIFIED |
| `QUOTE-004` | Demand & Peak Date Manager | `/pricing/demand` | `saveDemandConfig()` | `DemandPricingConfig` | CODE VERIFIED |
| `QUOTE-005` | Manager Discount Approval | `/approvals` | `approveSalesQuotation()` | `SalesQuotation` | CODE VERIFIED |
| `QUOTE-006` | Tokenized Share Link Generator | `/quotations/[id]` | `createQuoteShareLink()` | `QuoteShareLink` | CODE VERIFIED |
| `QUOTE-007` | Public Proposal Viewer Portal | `/q/[token]` | Page Handler | `QuoteShareLink` | CODE VERIFIED |
| `QUOTE-008` | Quote Radar View Telemetry | `/q/[token]` | `recordQuoteView()` | `QuoteView` | CODE VERIFIED |
| `QUOTE-009` | One-Tap Booking Deposit Pay | `/q/[token]` | `executeOneTapPay()` | `Invoice`, `Booking` | CODE VERIFIED |
| `QUOTE-010` | Quotation to Booking Conversion | `/quotations/[id]` | `convertQuotationToBooking()` | `Booking` | CODE VERIFIED |
| `QUOTE-011` | Silent Quote Nudge Cron | `/api/cron/quote-nudge` | Cron Handler | `QuoteShareLink` | CODE VERIFIED |
| `QUOTE-012` | Quotation PDF Export | `/api/quotations/[id]/pdf` | Route Handler | `SalesQuotation` | CODE VERIFIED |
