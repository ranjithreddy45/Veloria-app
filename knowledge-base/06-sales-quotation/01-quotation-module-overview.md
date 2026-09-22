# Sales Quotation & Dynamic Pricing Architecture Overview

## Overview

The Sales Quotation & Dynamic Pricing Engine in Veloria Grand provides an end-to-end pricing calculation, package bundling, discount approval, tokenized public sharing, and booking conversion platform.

---

## Technical Pipeline & Architecture Diagram

```mermaid
flowchart TD
    Lead[Lead CRM Record / Inquiry] --> Builder[Quotation Builder / Tier Builder<br/>/quotations/new & tier-builder.tsx]
    Builder --> Package[Package & Catalog Selector<br/>EventPackage, VendorPackage]
    Builder --> Engine[Dynamic Yield & Pricing Engine<br/>src/lib/pricing/yield-engine.ts]
    Engine --> Calc[Subtotal, GST Tax & Discount Calc<br/>src/lib/sales/quotation-calc.ts]
    Calc --> Approval{Discount > Threshold?}
    Approval -- Yes --> ApproveQueue[Approval Queue<br/>PENDING_APPROVAL -> APPROVED]
    Approval -- No --> Save[Save SalesQuotation Record<br/>VG-Q-NNNNN]
    ApproveQueue --> Save
    Save --> Token[Generate QuoteShareLink Token<br/>/q/[token]]
    Token --> PublicPortal[Public Quote Viewer Portal<br/>/q/[token] & quote-radar-beacon.tsx]
    PublicPortal --> Radar[Quote Radar View Tracking<br/>QuoteView Record]
    PublicPortal --> OneTap[One-Tap Deposit Checkout<br/>/pay/[bookingId]]
    OneTap --> Booking[Convert to Confirmed Booking<br/>src/actions/quotation-booking.actions.ts]
```

---

## Evidence Summary

| Component / Layer | Primary File / Code Reference | Status |
|---|---|---|
| Quotation Builder UI | `src/app/(dashboard)/quotations/new/page.tsx`, `tier-builder.tsx` | CODE VERIFIED |
| Yield & Dynamic Pricing Engine | `src/lib/pricing/yield-engine.ts`, `src/actions/yield-pricing.actions.ts` | CODE VERIFIED |
| Calculation & GST Rules | `src/lib/sales/quotation-calc.ts`, `VenueTaxSlab` | CODE VERIFIED |
| Public Quote Viewer Portal | `src/app/(public)/q/[token]/page.tsx`, `public-quote-view.tsx` | CODE VERIFIED |
| Quote Radar View Tracking | `src/actions/public-quote-radar.actions.ts`, `QuoteView` | CODE VERIFIED |
| One-Tap Deposit Payment | `src/actions/quote-onetap.actions.ts`, `one-tap-pay.tsx` | CODE VERIFIED |
