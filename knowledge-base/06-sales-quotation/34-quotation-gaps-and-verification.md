# Gaps & Factual Verification Matrix

## Overview

Factual audit matrix verifying quotation features against business expectations.

---

## Verification Matrix

| Area | Finding | Evidence Source | Status | Manual Action Required |
|---|---|---|---|---|
| Yield Pricing Engine | Configurable date multipliers adjust subtotal | `src/lib/pricing/yield-engine.ts` | CODE VERIFIED | Verify active rules |
| One-Tap Deposit | Razorpay widget triggers `convertQuotationToBooking()` | `one-tap-pay.tsx` | CODE VERIFIED | Test live payment gateway |
| PDF Generation | Next.js API route streams PDF proposals | `/api/quotations/[id]/pdf` | CODE VERIFIED | Test Puppeteer binary |
