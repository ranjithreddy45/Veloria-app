# Route Map Overview

## Overview

This document provides a comprehensive high-level summary of all routing endpoints discovered across the Veloria Grand application repository.

---

## Route Census Summary

| Route Metric | Count | Description | Evidence Status |
|---|---|---|---|
| **Total Route Files** | **593** | Total `page.tsx` and `route.ts` files in `src/app` | CODE VERIFIED |
| **Page Routes (UI)** | **482** | User-facing Next.js page components | CODE VERIFIED |
| **API Endpoints** | **111** | Server-side REST / JSON API routes | CODE VERIFIED |
| **Dynamic Routes** | **140** | Routes containing URL parameters `[id]`, `[token]`, etc. | CODE VERIFIED |

---

## Route Breakdown by Functional Category

| Category | Page Routes | API Routes | Total Endpoints | Primary Target Audience |
|---|---|---|---|---|
| **Internal Dashboard** | 395 | 0 | 395 | Staff, Managers, Executives, Admins |
| **API Endpoints** | 0 | 111 | 111 | Frontend UI, Mobile App, External Webhooks |
| **Guest Services** | 28 | 0 | 28 | Event Guests, Attendees, Invitation Viewers |
| **Public Services** | 23 | 0 | 23 | Unauthenticated Visitors, Quote Viewers |
| **Client Portal** | 17 | 0 | 17 | Booked Clients (`CLIENT` role) |
| **Authentication** | 5 | 0 | 5 | Login, Password Reset, Auth Callbacks |
| **Vendor Portal** | 4 | 0 | 4 | External Suppliers & Contractors (`VENDOR` role) |
| **Payment & Checkout** | 2 | 0 | 2 | Public Payment Gateways & Booking Holds |
| **Onboarding** | 1 | 0 | 1 | Vendor & Partner Self-Onboarding |
| **Print Views** | 1 | 0 | 1 | Printable Quotations, Invoices & BEOs |
| **Widgets** | 1 | 0 | 1 | Embedded Booking / Inquiry Widgets |
| **Other / Utility** | 5 | 0 | 5 | Error, Style Guide, Offline Fallbacks |
| **TOTAL** | **482** | **111** | **593** | All Categories |

---

## Key Topology Highlights

- **Route Group Isolation**: Next.js route groups `(dashboard)`, `(portal)`, `(vendor-portal)`, `(guest)`, `(public)`, and `(auth)` provide logical separation without polluting URL paths.
- **Middleware Protection**: All internal dashboard routes are guarded at the edge by `middleware.ts` enforcing `routePermission()` rules.
