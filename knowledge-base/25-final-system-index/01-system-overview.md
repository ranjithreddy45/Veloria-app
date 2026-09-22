# Phase 1: System Executive Summary

## 1. Product Purpose
Veloria Grand is an enterprise-grade venue management, luxury event orchestration, hospitality ERP, and CRM platform. It provides end-to-end management for leads, sales quotations, contract lifecycle, booking calendars, Banquet Event Orders (BEO), kitchen prep & inventory, vendor procurement, invoicing, payment gateways, general ledger accounting, employee central HR, biometric/manual attendance, leave, fixed-denominator payroll, candidate recruitment, property acquisition BD, marketing campaign tracking, WhatsApp/Email communications, dedicated client/vendor portals, and operational analytics.

## 2. System Architecture & Tech Stack
- **Framework**: Next.js 16.1.6 (App Router) with React 19.2.3 and TypeScript.
- **ORM & Database**: Prisma 6.19.2 connected to PostgreSQL.
- **Authentication**: NextAuth.js v5 (JWT sessions, HTTP-only cookies).
- **Styling UI**: Tailwind CSS v4, Lucide React, Shadcn/Radix UI.
- **Mobile Runtime**: Capacitor 8.1.
- **Integrations**: AWS S3, Razorpay, Resend Email, Meta WhatsApp Cloud API, Weflux, OpenAI, Google Ads / Facebook Lead Ads APIs.

## 3. Application Structure
- `/src/app`: Page routes, API endpoints, public portals.
- `/src/actions`: Next.js Server Actions grouped by domain (`booking.ts`, `finance.ts`, `hr.ts`, `lead.ts`, etc.).
- `/src/lib`: Core business logic engines (`payroll-calc.ts`, `journal.ts`, `prisma.ts`, `s3.ts`, `whatsapp.ts`, etc.).
- `/prisma`: Schema definition (`schema.prisma`) and SQL migrations.

## 4. Major Business Domains
1. CRM & Lead Management
2. Sales & Quotation Engine
3. Contracts & Digital Signatures
4. Venue Booking & Event Operations (BEO)
5. Kitchen Prep & Inventory Management
6. Vendor Management & Procurement (PO / AP)
7. Invoicing, Payments & Payment Gateways
8. Double-Entry General Ledger & Financial Management
9. HR, Attendance, Leave & Fixed 30-Day Payroll
10. Recruitment & Hiring Pipeline
11. Business Development & Property Acquisition
12. Marketing Campaign & Ad Attribution
13. WhatsApp & Multi-Channel Communications
14. Client & Vendor Portals
15. Analytics, Financial Reports & Immutable Audit Logging
16. Expense Claims & Employee Reimbursements

## 5. Deployment, Automation & Security
- **Deployment**: Serverless / Containerized Node.js.
- **Automation**: 56 background cron endpoints, automated GL posting on invoices/payments/payroll, SLA timers.
- **Security Boundaries**: NextAuth session validation, RBAC with 23 verified roles, 256-bit token entropy for public links, S3 presigned URLs, Razorpay webhook signature verification.
