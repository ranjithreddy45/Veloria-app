# PHASE 06 — LEAD CRM UI FORENSICS: SYSTEM OVERVIEW

## 1. Executive Summary

This document provides the foundational UI forensic analysis for the **Lead CRM System** of **Veloria Grand** (Next.js 16.1.6, React 19.2.3, NextAuth 5, Tailwind CSS 4, Radix UI, Prisma 6.19.2).

The Lead CRM layer forms the primary commercial entry engine for Veloria Grand. It manages incoming event enquiries, lead scoring, assignment, SLA tracking, communication history, follow-up scheduling, site visits, and seamless conversion into formal Quotations (`/quotations/new`) or Bookings (`/bookings/new`).

```
ENQUIRY / CAPTURE ──► LEAD INBOX (/leads) ──► ASSIGNMENT & SLA ──► LEAD DETAIL (/leads/[id]) ──► FOLLOW-UP & VISIT ──► QUOTATION / BOOKING
```

---

## 2. Core Lead CRM Architecture & Component Layers

| Layer | Primary Technology | Key Source File(s) | Function / Purpose |
|---|---|---|---|
| **Lead Inbox & Master Table** | React Server/Client Component | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/page.tsx) | Primary list/table view with filter bar, stat strip, and bulk actions |
| **Lead Detail Workspace** | React Server/Client Component | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/[leadId]/page.tsx) | Complete lead profile, AI score card, timeline, notes, visits, and quick actions |
| **Lead Form (Create / Edit)** | React Client Component | [lead-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/_components/lead-form.tsx) | Form for creating and editing lead attributes and contact details |
| **Lead Import Engine** | React Client Component | [lead-import-client.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/import/_components/lead-import-client.tsx) | Bulk CSV lead import with field mapping and validation |
| **Speed-to-Lead SLA Cockpit** | React Server/Client Component | [sla-cockpit.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/sla/_components/sla-cockpit.tsx) | SLA breach monitoring, countdown timers, and war room queue |
| **Lead Actions & Server Logic**| Server Actions | [lead.actions.ts](file:///Users/fci/Documents/Veloria-app/src/actions/lead.actions.ts) | Server-side CRUD, assignment, status update, and customer conversion |

---

## 3. Supported Lead CRM Roles & Permissions

- **Sales Rep (`SALES`)**: Views assigned leads, creates enquiries, updates status/quality, schedules follow-ups/site visits, converts to quotes.
- **Sales Manager / Admin (`ADMIN`, `GENERAL_MANAGER`)**: Full visibility across all leads, bulk re-assignment, SLA breach override, lead deletion, import/export.
- **Business Development (`BD`)**: BD-specific lead inbox (`/bd/leads`), acquisition lead management.
