# API Routes (111 Endpoints)

## Overview

Veloria Grand exposes 111 server-side API route handlers (`src/app/api/**/route.ts`) serving JSON endpoints for client components, background cron jobs, and external webhooks.

---

## Major API Route Clusters

### 1. Webhook Handlers (`/api/webhooks/*`)
- **`/api/webhooks/razorpay`**: Payment status callback (HMAC signature verified).
- **`/api/webhooks/whatsapp`**: Inbound Meta WhatsApp Cloud API messaging events.

### 2. Cron Jobs (`/api/cron/*`)
- **`/api/cron/notifications`**: Scheduled reminder dispatch (`CRON_SECRET` protected).
- **`/api/cron/billing`**: Recurring billing & automated payment reminder processor.

### 3. Portal Endpoints (`/api/portal/*`)
- **`/api/portal/client/*`**: Client portal data endpoints (`CLIENT` role).
- **`/api/portal/vendor/*`**: Vendor portal data endpoints (`VENDOR` role).

### 4. Admin & Entity APIs (`/api/users`, `/api/reports`, etc.)
- **`/api/users`**: User management JSON API.
- **`/api/reports/sales`**: Sales export data API.
