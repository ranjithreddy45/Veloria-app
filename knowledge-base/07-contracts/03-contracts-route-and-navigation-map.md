# Contracts Route & Navigation Map

## Overview

Census of internal dashboard routes, client portal pages, public signing portals, and API endpoints.

---

## Route Census Table

| Route Path | Filesystem Location | Category | Purpose | Access Control |
|---|---|---|---|---|
| `/contracts` | `src/app/(dashboard)/contracts/page.tsx` | Internal Dashboard | Master contract dashboard & list | `contracts:read` |
| `/contracts/new` | `src/app/(dashboard)/contracts/new/page.tsx` | Internal Dashboard | Contract creation form | `contracts:create` |
| `/contracts/[contractId]` | `src/app/(dashboard)/contracts/[contractId]/page.tsx` | Internal Dashboard | Contract detail & versioning | `contracts:read` |
| `/bd/contracts` | `src/app/(dashboard)/bd/contracts/page.tsx` | Internal Dashboard | Landlord / BD acquisition contracts | `bd:read` |
| `/settings/contract-templates` | `src/app/(dashboard)/settings/contract-templates/page.tsx` | Internal Settings | Legal template editor & list | `templates:manage` |
| `/portal/contracts` | `src/app/(portal)/portal/contracts/page.tsx` | Client Portal | Client portal contract list | `CLIENT` Role |
| `/sign/[token]` | `src/app/(public)/sign/[token]/page.tsx` | Public Signing | Public digital signature portal | Public (Tokenized) |
| `/api/bd/contracts/[id]/pdf` | `src/app/api/bd/contracts/[id]/pdf/route.ts` | API Endpoint | PDF document generator | Session / Token |
| `/api/cron/contract-reminders` | `src/app/api/cron/contract-reminders/route.ts` | Cron API | Automated unsigned contract reminder | `CRON_SECRET` |
