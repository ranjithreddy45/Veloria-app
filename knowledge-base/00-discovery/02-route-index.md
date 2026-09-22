# VELORIA GRAND — APP ROUTE INDEX

---

## 📌 Route Distribution Overview

- **Status Label**: `CODE VERIFIED`
- **Total Route Endpoints**: **593 Pages & API Routes**

---

## 🗺️ Route Group Breakdown

| Route Group / Top Directory | Route Count | Access Control / Primary Roles | Purpose / Scope |
|---|---|---|---|
| `src/app/(dashboard)/*` | **395 routes** | Internal Staff Roles (`INTERNAL_ROLES`) | Lead CRM, Quotations, Bookings, BEO, Finance, HR, Operations |
| `src/app/api/*` | **111 routes** | System / Webhook Tokens / Session | Cron jobs (56), Webhooks (7), REST API endpoints (48) |
| `src/app/(guest)/*` | **28 routes** | Guests / Public Event Code | Guest event RSVP, menu selection, itinerary |
| `src/app/(public)/*` | **21 routes** | Public Tokenized Link | Public quotation viewer, e-signatures, slot holds |
| `src/app/(portal)/*` | **17 routes** | `CLIENT`, `SUPER_ADMIN`, `ADMIN` | Client booking portal, invoices, documents, feedback |
| `src/app/(auth)/*` | **5 routes** | Unauthenticated | Sign-in, Sign-up, 2FA verification, password reset |
| `src/app/(vendor-portal)/*` | **4 routes** | `VENDOR`, `SUPER_ADMIN`, `ADMIN` | Vendor assigned jobs, work package bids, payout claims |
| `src/app/pay/*` | **2 routes** | Tokenized Checkout URL | Public Razorpay payment checkout interface |
| `src/app/careers/*` | **2 routes** | Public | Public job listings & applicant form |
| `src/app/widget/*` | **1 route** | Public / CORS | Embeddable website lead capture widget |
| `src/app/onboard/*` | **1 route** | Public | Vendor & franchise self-onboarding form |
| `src/app/design-lab/*` | **1 route** | `DESIGN_EXEC`, `DESIGN_HEAD`, `ADMIN` | Interactive venue floor plan design canvas |
