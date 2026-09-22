# Chunk 04: Comprehensive Route Map & Navigation

## Overview

This directory contains the definitive technical documentation for the Veloria Grand route map, App Router topology, URL parameters, navigation flows, and API endpoints.

---

## Table of Contents

| Document | Title | Description |
|---|---|---|
| [01-route-map-overview.md](01-route-map-overview.md) | Route Census Overview | High-level summary of all 593 route endpoints. |
| [02-route-discovery-method.md](02-route-discovery-method.md) | Discovery Methodology | Reproducible route parsing & normalization process. |
| [03-route-group-topology.md](03-route-group-topology.md) | Route Group Topology | Next.js App Router route group structure map. |
| [04-internal-dashboard-routes.md](04-internal-dashboard-routes.md) | Internal Dashboard Routes | Deep dive into 395 internal staff dashboard routes. |
| [05-client-portal-routes.md](05-client-portal-routes.md) | Client Portal Routes | Self-service routes for booked clients (`CLIENT` role). |
| [06-vendor-portal-routes.md](06-vendor-portal-routes.md) | Vendor Portal Routes | Supplier & contractor routes (`VENDOR` role). |
| [07-guest-routes.md](07-guest-routes.md) | Guest Routes | RSVP & event attendee invitation routes. |
| [08-public-routes.md](08-public-routes.md) | Public Routes | Unauthenticated marketing & public viewer pages. |
| [09-authentication-routes.md](09-authentication-routes.md) | Authentication Routes | Sign-in, registration, and password recovery pages. |
| [10-print-routes.md](10-print-routes.md) | Print Routes | Print-optimized document view routes. |
| [11-payment-routes.md](11-payment-routes.md) | Payment Routes | Public deposit & invoice payment checkout pages. |
| [12-onboarding-routes.md](12-onboarding-routes.md) | Onboarding Routes | Self-service vendor registration pages. |
| [13-widget-routes.md](13-widget-routes.md) | Widget Routes | Embeddable booking inquiry widgets. |
| [14-api-routes.md](14-api-routes.md) | API Routes | Server-side REST & JSON API handlers (111 routes). |
| [15-dynamic-route-patterns.md](15-dynamic-route-patterns.md) | Dynamic Route Patterns | URL parameter parameterization registry. |
| [16-route-permission-matrix.md](16-route-permission-matrix.md) | Route Permission Matrix | Middleware & RBAC route protection rules. |
| [17-route-to-navigation-map.md](17-route-to-navigation-map.md) | Navigation Map | Sidebar menu items to URL routes mapping. |
| [18-route-to-feature-map.md](18-route-to-feature-map.md) | Feature Map | Module mapping across 24 functional domains. |
| [19-route-to-server-action-map.md](19-route-to-server-action-map.md) | Server Action Map | Key routes to Next.js Server Actions mapping. |
| [20-route-to-database-domain-map.md](20-route-to-database-domain-map.md) | Database Domain Map | Routes to Prisma database models mapping. |
| [21-navigation-journeys.md](21-navigation-journeys.md) | Navigation Journeys | End-to-end user navigation sequence diagrams. |
| [22-route-dependencies.md](22-route-dependencies.md) | Route Dependencies | Prerequisite route chaining rules. |
| [23-orphaned-and-unreachable-routes.md](23-orphaned-and-unreachable-routes.md) | Orphaned Routes | Unlinked or special utility routes catalog. |
| [24-route-gaps-and-verification.md](24-route-gaps-and-verification.md) | Gaps & Verification | Factual audit matrix verifying route census. |
| [25-complete-route-index.md](25-complete-route-index.md) | Complete Route Index | Machine-readable index of all 593 endpoints (`ROUTE-0001` - `ROUTE-0593`). |

---

## Census Summary

- **Total Filesystem Routes**: 593 (482 `page.tsx` + 111 `route.ts`)
- **Status**: `CODE VERIFIED` against production App Router codebase.
