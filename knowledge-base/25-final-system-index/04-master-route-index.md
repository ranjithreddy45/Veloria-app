# Phase 4: Master Route Index

## 1. Route Scope & Reconciliation
- **Total Route Files**: 593 route files (482 Page files + 111 API route files).
- **Categorization Summary**:

| Category | Route Pattern | Auth Type | Primary Role / Permission | Dynamic Parameters |
|---|---|---|---|---|
| Auth | `/login`, `/api/auth/*` | Public / JWT | None | None |
| Dashboard | `/dashboard`, `/analytics` | NextAuth Session | `VIEW_DASHBOARD` | None |
| CRM | `/leads`, `/leads/[id]` | NextAuth Session | `MANAGE_LEADS` | `id` |
| Sales | `/sales/quotations`, `/sales/packages` | NextAuth Session | `MANAGE_SALES` | `id` |
| Contracts | `/contracts`, `/contracts/[id]` | NextAuth Session | `MANAGE_CONTRACTS` | `id` |
| Booking | `/bookings`, `/bookings/calendar` | NextAuth Session | `MANAGE_BOOKINGS` | `id` |
| Operations | `/beo`, `/beo/[id]`, `/operations` | NextAuth Session | `MANAGE_OPERATIONS` | `id` |
| Kitchen | `/kitchen/inventory`, `/kitchen/recipes` | NextAuth Session | `KITCHEN_STAFF` | `id` |
| Vendor | `/procurement/vendors`, `/vendor-portal/*` | NextAuth Session / Token | `PROCUREMENT_MANAGER` | `id` |
| Finance | `/finance/chart-of-accounts`, `/finance/journals` | NextAuth Session | `FINANCE_MANAGER` | `id` |
| HR | `/hr/employees`, `/hr/attendance`, `/hr/leave`, `/hr/payroll` | NextAuth Session | `HR_MANAGER` | `id` |
| Recruitment | `/hr/recruitment/jobs`, `/hr/recruitment/candidates` | NextAuth Session | `RECRUITER` | `id` |
| BD | `/bd/properties`, `/bd/deals` | NextAuth Session | `BD_MANAGER` | `id` |
| Marketing | `/marketing/campaigns`, `/marketing/ads` | NextAuth Session | `MARKETING_MANAGER` | `id` |
| Communications | `/communications/whatsapp`, `/communications/logs` | NextAuth Session | `COMMUNICATIONS_SPECIALIST` | `id` |
| Portals | `/portal/*`, `/vendor-portal/*` | Session / Token | Client / Vendor Role | `token` |
| Public Experience | `/q/[token]`, `/sign/[token]`, `/pay/[token]`, `/hold/[token]` | Public Token | Public Unauthenticated | `token` |
| API | `/api/v1/*`, `/api/cron/*`, `/api/webhooks/*` | API Key / Token | Service Account | Various |
