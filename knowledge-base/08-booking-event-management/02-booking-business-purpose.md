# 02 - Booking Business Purpose & Operational Purpose

---

## 🎯 Business Purpose
The Booking entity is the single commercial and operational record of truth for an event contracted at a Veloria Grand property or venue hall.

```
CODE VERIFIED BUSINESS BEHAVIOR:
1. Prevent venue double-booking across MORNING, EVENING, and FULL_DAY time slots via database indexing and availability grid queries (`getAvailabilityGrid`).
2. Lock commercial pricing (per plate price, hall rental, decor charges, other services) from the originating SalesQuotation (`src/actions/booking-invoice.actions.ts`).
3. Capture client RSVP confirmations, guest headcount declarations, and legal terms version acceptance (`guestConfirmationToken`, `guestConfirmedAt`, `guestConfirmedIp`).
4. Handoff event requirements to banquet operations via BEO function sheets (`src/actions/beo.actions.ts`).

INFERRED BUSINESS PURPOSE:
- Provides high-yield pricing dynamic adjustments based on seasonal date demand signals (`src/actions/yield-pricing.actions.ts`).
```

---

## 🔄 Cross-Functional Operational Dependencies

| Module | Direction | Operational Mechanics | Evidence |
|---|---|---|---|
| **Sales Quotation** | Inbound | Converts won quotation into `Booking` and generates deposit invoice | `src/actions/booking-invoice.actions.ts` |
| **Contract / E-Sign** | Inbound / Bidirectional | E-signed contract unlocks booking lock and triggers deposit schedule | `src/actions/contract.actions.ts` |
| **BEO / Operations** | Outbound | Populates banquet event order with contracted pax, menus, and run-of-show | `src/actions/beo.actions.ts` |
| **Invoicing & Payments** | Outbound | Generates advance tax invoices and tracks Razorpay settlements | `src/actions/invoice.actions.ts` |
| **Client Portal** | Outbound | Exposes guest list management, menu selection, and seating chart configuration | `src/actions/portal-guest.actions.ts` |
