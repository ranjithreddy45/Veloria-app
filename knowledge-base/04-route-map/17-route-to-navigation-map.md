# Route to Navigation Map

## Overview

Maps application UI navigation links to actual underlying Next.js routes.

---

## Sidebar to Route Mapping

| Sidebar Menu Label | Target Route | Allowed Roles | Backend Route Protection |
|---|---|---|---|
| Dashboard | `/dashboard` | All Staff | `middleware.ts` |
| Lead Pipeline | `/leads` | Sales Roles | `sales:read` Check |
| Quotations | `/quotations` | Sales Roles | `quotations:read` Check |
| Event Calendar | `/events` | Event/Ops Roles | `events:read` Check |
| BEO Operations | `/beo` | Ops Roles | `beo:read` Check |
| HR & Staff | `/hr` | HR Roles | `hr:read` Check |
| Invoices & GL | `/finance` | Finance Roles | `finance:read` Check |
