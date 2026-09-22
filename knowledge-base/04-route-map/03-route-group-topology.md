# Route Group Topology

## Overview

Veloria Grand structures its App Router filesystem using Next.js Route Groups to segregate layouts, authentication boundaries, and tenant experiences.

---

## App Router Directory Map

```mermaid
graph TD
    App["src/app/"] --> Auth["(auth)/ [5 pages]"]
    App --> Dashboard["(dashboard)/ [395 pages]"]
    App --> Portal["(portal)/ [17 pages]"]
    App --> VendorPortal["(vendor-portal)/ [4 pages]"]
    App --> Guest["(guest)/ [28 pages]"]
    App --> Public["(public)/ [23 pages]"]
    App --> API["api/ [111 routes]"]
    App --> Pay["pay/ [2 pages]"]
    App --> Onboard["onboard/ [1 page]"]
    App --> Widget["widget/ [1 page]"]
    App --> Print["(print)/ [1 page]"]

    Auth --> Login["/login"]
    Dashboard --> Sales["/sales"]
    Dashboard --> Events["/events"]
    Dashboard --> HR["/hr"]
    Dashboard --> Finance["/finance"]
    Portal --> ClientDash["/client/dashboard"]
    VendorPortal --> VendorDash["/vendor/dashboard"]
    API --> Webhooks["/api/webhooks/*"]
    API --> Cron["/api/cron/*"]
```

---

## Topology Summary Table

| Route Group | Base URL Path | Isolated Layout File | Primary Role Scope |
|---|---|---|---|
| `(auth)` | `/login`, `/register` | `src/app/(auth)/layout.tsx` | Unauthenticated / Guests |
| `(dashboard)` | `/dashboard`, `/sales`, `/hr`, etc. | `src/app/(dashboard)/layout.tsx` | Internal Staff & Admin Roles |
| `(portal)` | `/client/*` | `src/app/(portal)/layout.tsx` | `CLIENT` Role |
| `(vendor-portal)` | `/vendor/*` | `src/app/(vendor-portal)/layout.tsx` | `VENDOR` Role |
| `(guest)` | `/guest/*`, `/event-guest/*` | `src/app/(guest)/layout.tsx` | Event Guests & Public Attendees |
| `(public)` | `/events`, `/about`, `/contact` | `src/app/(public)/layout.tsx` | Unauthenticated Public |
| `api` | `/api/*` | N/A (Route Handlers) | Mixed (Session / Secret / Signature) |
