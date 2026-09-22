# Server Actions & API Inventory

## Overview

Complete reference for backend Server Actions and API endpoints powering the quotation and pricing engine.

---

## Server Actions (`src/actions/`)

- `createSalesQuotation()` (`sales-quotation.actions.ts`): Creates a new quotation and generates serial number `VG-Q-NNNNN`.
- `approveSalesQuotation()` (`sales-quotation.actions.ts`): Approves discount and freezes output JSON.
- `convertQuotationToBooking()` (`quotation-booking.actions.ts`): Converts proposal to confirmed booking slot lock.
- `createQuoteShareLink()` (`quote-share-public.actions.ts`): Generates `/q/[token]` public link.
- `recordQuoteView()` (`public-quote-radar.actions.ts`): Logs Quote Radar telemetry (`QuoteView`).
- `createPricingRule()` (`pricing.actions.ts` & `yield-pricing.actions.ts`): Configures dynamic yield pricing multipliers.

---

## API Endpoints (`src/app/api/`)

- `GET /api/quotations/[id]/pdf`: Renders printable PDF document.
- `GET /api/cron/quote-nudge`: Executes hourly silent nudge cron.
- `GET /api/cron/winback-abandoned-quote`: Executes abandoned quote winback.
